"""
ACQR Fast Test Runner — calls the deterministic pipeline directly (no AI).
Runs all 100 test cases in seconds and writes test_results.log
"""

import re
import sys
import os
import json
from datetime import datetime

# Make services importable without a server
sys.path.insert(0, os.path.dirname(__file__))

from services.analyzer import (
    detect_syntax_errors,
    detect_structural_issues,
    detect_unterminated_strings,
    detect_runtime_risks,
    detect_logical_and_lint_issues,
    detect_intent_mismatch,
    run_pylint,
)

TEST_FILE = "test.py"
LOG_FILE  = "test_results.log"


# ── 1. Parse test.py ─────────────────────────────────────────────────────────
def parse_tests(path: str) -> dict[int, str]:
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    blocks = re.split(r"### TEST (\d+)\s*\n", raw)
    tests: dict[int, str] = {}
    i = 1
    while i + 1 < len(blocks):
        tests[int(blocks[i])] = blocks[i + 1].strip()
        i += 2
    return tests


# ── 2. Run deterministic pipeline for one snippet ─────────────────────────────
def run_pipeline(code: str) -> list[dict]:
    issues: list[dict] = []
    seen: set[tuple] = set()

    def add(iss_list):
        for iss in iss_list:
            key = (iss.get("line"), iss.get("type"))
            if key not in seen:
                seen.add(key)
                issues.append(iss)

    # Layer 1 — AST syntax gate
    syntax = detect_syntax_errors(code)
    add(syntax)

    # Layer 1b — Structural (regex, catches multi-error patterns)
    add(detect_structural_issues(code))

    # If any syntax issue was found, stop here (mirrors the real pipeline)
    if issues:
        return issues

    # Layer 2 — Heuristics (only runs on syntactically valid code)
    add(detect_unterminated_strings(code))
    add(detect_runtime_risks(code))
    add(detect_logical_and_lint_issues(code))

    # Intent
    try:
        add(detect_intent_mismatch(code))
    except Exception:
        pass

    # Layer 3 — Pylint (lint only)
    try:
        import json
        raw = run_pylint(code)
        for err in json.loads(raw):
            if err.get("message-id") in {"E0401", "E0601", "E0602"}:
                key = (err.get("line"), "lint")
                if key not in seen:
                    seen.add(key)
                    issues.append({"line": err.get("line"), "type": "lint", "message": err.get("message",""), "source": ["static"], "fix": None})
    except Exception:
        pass

    return issues


# ── 3. Format one result block ────────────────────────────────────────────────
def format_result(test_id: int, code: str, issues: list[dict]) -> str:
    lines = [
        f"\n{'═'*72}",
        f"  TEST {test_id:>3}",
        f"{'═'*72}",
        "",
        "  CODE:",
        *[f"    {ln}" for ln in code.splitlines()],
        "",
    ]

    if not issues:
        lines.append("  ✅  No issues detected")
    else:
        lines.append(f"  🔍  {len(issues)} issue(s):")
        for idx, iss in enumerate(issues, 1):
            fix  = iss.get("fix")
            has_fix = "✔ fix" if fix else "✘ no fix"
            lines += [
                "",
                f"  [{idx}]  line={iss.get('line','?')}  type={iss.get('type','?')}  "
                f"sev={iss.get('severity','?')}  src={iss.get('source','?')}  [{has_fix}]",
                f"         {iss.get('message') or iss.get('error','')}",
            ]
            short = iss.get("short_explanation") or iss.get("explanation","")
            if short:
                lines.append(f"         → {short[:100]}")
            sugg = iss.get("suggestion","")
            if sugg:
                lines.append(f"         💡 {sugg[:100]}")
            if fix:
                if fix.get("type") == "replace_line":
                    lines.append(f"         🔧 replace line {fix['line']} → {repr(fix.get('new_code',''))[:80]}")
                elif fix.get("changes"):
                    for ch in fix["changes"]:
                        lines.append(
                            f"         🔧 L{ch.get('line_start')}→{ch.get('line_end')} "
                            f"= {repr(ch.get('replacement',''))[:80]}"
                        )

    lines.append("")
    return "\n".join(lines)


# ── 4. Summary ────────────────────────────────────────────────────────────────
def build_summary(results: dict[int, list]) -> str:
    total   = len(results)
    broken  = sum(1 for v in results.values() if v)
    clean   = total - broken
    fixes   = sum(1 for v in results.values() for i in v if i.get("fix"))
    total_i = sum(len(v) for v in results.values())

    type_counts: dict[str, int] = {}
    for issues in results.values():
        for iss in issues:
            t = iss.get("type","?")
            type_counts[t] = type_counts.get(t, 0) + 1

    lines = [
        f"\n{'═'*72}",
        f"  ACQR TEST SUMMARY  —  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"{'═'*72}",
        f"  Total test cases  : {total}",
        f"  Cases with issues : {broken}",
        f"  Clean cases       : {clean}",
        f"  Total issues      : {total_i}",
        f"  Issues with a fix : {fixes}",
        f"{'─'*72}",
        "  BY TYPE:",
    ]
    for t, cnt in sorted(type_counts.items(), key=lambda x: -x[1]):
        lines.append(f"    {t:<14} {cnt:>4}")
    lines.append(f"{'═'*72}")
    return "\n".join(lines)


# ── 5. Main ───────────────────────────────────────────────────────────────────
def main():
    print(f"Parsing {TEST_FILE} …")
    tests = parse_tests(TEST_FILE)
    print(f"Running {len(tests)} cases (deterministic pipeline only, no AI) …\n")

    results: dict[int, list] = {}
    for tid in sorted(tests):
        code = tests[tid]
        issues = run_pipeline(code)
        results[tid] = issues
        tag = f"{len(issues)} issue(s)" if issues else "clean"
        print(f"  TEST {tid:>3} … {tag}")

    summary = build_summary(results)
    print(summary)

    with open(LOG_FILE, "w", encoding="utf-8") as log:
        log.write(f"ACQR FAST TEST RESULTS (deterministic pipeline)\n")
        log.write(f"Run at: {datetime.now().isoformat()}\n")
        log.write(summary)
        log.write("\n\nDETAILED RESULTS\n")
        for tid in sorted(tests):
            log.write(format_result(tid, tests[tid], results[tid]))

    print(f"\n✅  Log written → {LOG_FILE}")


if __name__ == "__main__":
    main()
