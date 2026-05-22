"""
ACQR Test Runner
Parses test.py (100 code snippets), sends each to POST /analyze,
writes results to test_results.log
"""

import re
import json
import urllib.request
import urllib.error
import textwrap
from datetime import datetime

API_URL   = "http://127.0.0.1:8000/analyze"
TEST_FILE = "test.py"
LOG_FILE  = "test_results.log"

# ── 1. Parse test.py into {id: code} ─────────────────────────────────────────
def parse_tests(path: str) -> dict[int, str]:
    with open(path, encoding="utf-8") as f:
        raw = f.read()

    blocks = re.split(r"### TEST (\d+)\s*\n", raw)
    tests  = {}
    # blocks = [preamble, id, code, id, code, ...]
    i = 1
    while i + 1 < len(blocks):
        test_id   = int(blocks[i])
        test_code = blocks[i + 1].strip()
        tests[test_id] = test_code
        i += 2
    return tests


# ── 2. POST to /analyze ───────────────────────────────────────────────────────
def analyze(code: str) -> dict:
    payload = json.dumps({"code": code}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}"}
    except Exception as e:
        return {"error": str(e)}


# ── 3. Format a single result block ──────────────────────────────────────────
def format_result(test_id: int, code: str, result: dict) -> str:
    sep = "─" * 72
    lines = [
        f"\n{'═' * 72}",
        f"  TEST {test_id:>3}",
        f"{'═' * 72}",
        "",
        "  CODE:",
        *[f"    {ln}" for ln in code.splitlines()],
        "",
    ]

    errors = result.get("errors", [])
    api_err = result.get("error")

    if api_err:
        lines.append(f"  ⚠️  REQUEST ERROR: {api_err}")
    elif not errors:
        lines.append("  ✅  No issues detected")
    else:
        lines.append(f"  🔍  {len(errors)} issue(s) found:")
        for idx, issue in enumerate(errors, 1):
            lines.append(f"")
            lines.append(f"  [{idx}] Line {issue.get('line', '?')}  |  "
                         f"type={issue.get('type','?')}  |  "
                         f"severity={issue.get('severity','?')}  |  "
                         f"source={issue.get('source','?')}")
            lines.append(f"      error   : {issue.get('error','')}")
            short = issue.get('short_explanation','')
            if short:
                lines.append(f"      short   : {short}")
            sugg = issue.get('suggestion','')
            if sugg:
                lines.append(f"      suggest : {sugg}")
            fix = issue.get('fix')
            if fix:
                fix_type = fix.get('type','patch')
                if fix_type == "replace_line":
                    lines.append(f"      fix     : replace_line {fix.get('line')} → "
                                 f"{repr(fix.get('new_code',''))}")
                elif fix.get('changes'):
                    for ch in fix['changes']:
                        lines.append(f"      fix     : L{ch.get('line_start')}–"
                                     f"L{ch.get('line_end')} → "
                                     f"{repr(ch.get('replacement',''))}")
            else:
                lines.append(f"      fix     : (none)")

    lines.append("")
    return "\n".join(lines)


# ── 4. Summary table ──────────────────────────────────────────────────────────
def build_summary(tests: dict, results: dict) -> str:
    total        = len(tests)
    detected     = sum(1 for r in results.values() if r.get("errors"))
    clean        = sum(1 for r in results.values() if not r.get("errors") and not r.get("error"))
    request_errs = sum(1 for r in results.values() if r.get("error"))
    has_fix      = sum(
        1 for r in results.values()
        for e in r.get("errors", [])
        if e.get("fix")
    )
    total_issues = sum(len(r.get("errors", [])) for r in results.values())

    lines = [
        f"\n{'═' * 72}",
        f"  SUMMARY  —  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"{'═' * 72}",
        f"  Total test cases  : {total}",
        f"  Issues detected   : {detected} cases  ({total_issues} total issues)",
        f"  No issues found   : {clean} cases",
        f"  Request errors    : {request_errs} cases",
        f"  Issues with a fix : {has_fix}",
        f"{'═' * 72}",
        "",
        "  ISSUE TYPE BREAKDOWN:",
    ]

    type_counts: dict[str, int] = {}
    for r in results.values():
        for e in r.get("errors", []):
            t = e.get("type", "unknown")
            type_counts[t] = type_counts.get(t, 0) + 1

    for t, cnt in sorted(type_counts.items(), key=lambda x: -x[1]):
        lines.append(f"    {t:<12} {cnt:>4} issue(s)")

    return "\n".join(lines)


# ── 5. Main ───────────────────────────────────────────────────────────────────
def main():
    print(f"Parsing {TEST_FILE}…")
    tests = parse_tests(TEST_FILE)
    print(f"Found {len(tests)} test cases.")
    print(f"Sending to {API_URL} …\n")

    results: dict[int, dict] = {}

    for test_id in sorted(tests):
        code = tests[test_id]
        print(f"  TEST {test_id:>3} … ", end="", flush=True)
        result = analyze(code)
        results[test_id] = result
        n = len(result.get("errors", []))
        tag = f"{n} issue(s)" if n else ("ERR" if result.get("error") else "clean")
        print(tag)

    # Write log
    with open(LOG_FILE, "w", encoding="utf-8") as log:
        log.write(f"ACQR TEST RESULTS\n")
        log.write(f"Run at: {datetime.now().isoformat()}\n")
        log.write(build_summary(tests, results))
        log.write("\n\n")
        log.write("DETAILED RESULTS\n")
        for test_id in sorted(tests):
            log.write(format_result(test_id, tests[test_id], results[test_id]))

    print(f"\n✅ Log written to: {LOG_FILE}")


if __name__ == "__main__":
    main()
