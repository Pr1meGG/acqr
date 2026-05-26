import os
import tempfile
import subprocess
import json
import ast
import re
from typing import List, Dict, Any
from services.ai_explainer import generate_llm_insights
from services.intent_engine import detect_intent_mismatch
from services.feedback_engine import adjust_confidence
from services.retriever import find_bpeid_record

# ---------------------------------------------------------------------------
# Pylint runner
# ---------------------------------------------------------------------------
def run_pylint(code: str) -> str:
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode="w", encoding="utf-8") as tmp:
            tmp.write(code)
            tmp.flush()
            tmp_path = tmp.name

        result = subprocess.run(
            ["pylint", tmp_path, "--output-format=json", "--score=no"],
            capture_output=True, text=True, check=False
        )
        return result.stdout.replace(tmp_path, "<your_file>")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# Fallback Logic (Deterministic)
# ---------------------------------------------------------------------------
def get_fallback_insight(code: str, error_detail: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deterministic fallback logic when LLM fails.
    """
    line_num = error_detail.get("line", 1)
    msg = error_detail.get("message", "").lower()
    symbol = error_detail.get("symbol", "").lower()
    
    lines = code.splitlines()
    line_content = lines[line_num - 1] if 0 < line_num <= len(lines) else ""
    trimmed_line = line_content.strip()

    explanation = f"Python found an issue: {msg}"
    fix_replacement = line_content
    suggestion = "Check the syntax on this line for typos."
    use_structured = False

    if "undefined-variable" in symbol or "nameerror" in msg:
        var_match = re.search(r"'([^']+)'", msg)
        var_name = var_match.group(1) if var_match else "variable"
        explanation = f"The variable '{var_name}' is used but hasn't been defined yet."
        fix_replacement = f"{var_name} = ...\n{line_content}"
        suggestion = f"Initialize '{var_name}' with a value before using it."
    elif "syntax-error" in symbol or "syntaxerror" in msg:
        if any(kw in trimmed_line for kw in ["if", "for", "while", "def"]) and not trimmed_line.endswith(":"):
            explanation = "Missing colon ':' at the end of the block header."
            fix_replacement = line_content.rstrip() + ":"
            suggestion = "Add ':' at the end of this line to open the block."
            use_structured = True

    fix = make_structured_fix(line_num, fix_replacement) if use_structured else {
        "type": "patch",
        "changes": [{"line_start": line_num, "line_end": line_num, "replacement": fix_replacement}]
    }

    return {"explanation": explanation, "fix": fix, "suggestion": suggestion}


def normalize(msg: str) -> str:
    return msg.lower().strip() if msg else ""


def make_structured_fix(line_num: int, new_code: str) -> Dict[str, Any]:
    """Return a replace_line fix with a backward-compatible changes[] entry."""
    return {
        "type": "replace_line",
        "line": line_num,
        "new_code": new_code,
        # kept for backward-compat with existing applyFix path
        "changes": [
            {
                "line_start": line_num,
                "line_end": line_num,
                "replacement": new_code
            }
        ]
    }


def filter_suggestion(sugg: str) -> str:
    if not sugg: return ""
    lower = sugg.lower()
    bad_phrases = ["use linter", "use ide", "flake8", "pylint", "linter plugin", "check syntax", "review code"]
    if any(p in lower for p in bad_phrases):
        return "Review the logic and correct the structure."
    return sugg


def make_short_explanation(explanation: str, issue_type: str, message: str) -> str:
    """Condense any explanation to ≤12 words, jargon-free."""
    # Fast-path: type-aware deterministic summaries
    if not explanation:
        explanation = ""
    msg_lower = (message or "").lower()
    exp_lower = explanation.lower()

    # Unterminated string
    if "unterminated string" in msg_lower or "unterminated string" in exp_lower:
        q = "'" if "'" in (message or "") else '"'
        return f"Missing closing {q} in the string."
    # Missing colon
    if "missing colon" in exp_lower or "expected ':'" in exp_lower or "missing colon" in msg_lower:
        return "Add ':' at the end of the block header."
    # Division by zero
    if "zero" in msg_lower or "zerodivision" in exp_lower:
        return "Dividing by zero will crash the program."
    # Infinite loop
    if "infinite loop" in msg_lower or "infinite" in exp_lower:
        return "Loop runs forever with no exit condition."
    # Mutable default
    if "mutable default" in msg_lower:
        return "Default list is shared across all function calls."
    # Undefined variable
    if "undefined" in msg_lower or "not defined" in exp_lower or "hasn't been defined" in exp_lower:
        var_match = re.search(r"'([^']+)'", message or explanation)
        var = var_match.group(1) if var_match else "variable"
        return f"'{var}' is used before being defined."
    # Unused variable
    if "unused variable" in msg_lower:
        var_match = re.search(r"'([^']+)'", message or "")
        var = var_match.group(1) if var_match else "variable"
        return f"'{var}' is assigned but never used."
    # Shadows builtin
    if "shadows built-in" in msg_lower or "shadow" in msg_lower:
        return "This name overwrites a Python built-in."
    # Unsafe division
    if "unsafe division" in msg_lower:
        return "Division without a zero check may crash."
    # Missing return
    if "missing return" in msg_lower:
        return "Function may not return a value."
    # Wrong square
    if "square" in msg_lower and ("add" in exp_lower or "multiply" in exp_lower):
        return "Wrong formula: use multiplication, not addition."

    # Generic fallback: take first sentence, truncate to 12 words
    first_sentence = re.split(r'[.!?]', explanation.strip())[0].strip()
    words = first_sentence.split()
    if len(words) <= 12:
        return first_sentence + ("" if first_sentence.endswith(".") else ".")
    return " ".join(words[:12]) + "…"

def repair_unterminated_string(line: str) -> tuple:
    """
    Detects and repairs an unterminated string on a single line.
    Returns (repaired_line, quote_char) or (None, None) if no issue found.
    """
    # Track string state using a simple scanner (handles mixed quotes)
    in_string = False
    current_quote = None
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == '\\' and in_string:
            i += 2  # skip escaped character
            continue
        if not in_string and ch in ('"', "'"):
            # Check for triple-quote strings (pass them through)
            triple = line[i:i+3]
            if triple in ('"""', "'''"):
                end = line.find(triple, i + 3)
                if end == -1:
                    # Unclosed triple-quote — append the triple and return
                    return line.rstrip() + triple, triple
                i = end + 3
                continue
            in_string = True
            current_quote = ch
        elif in_string and ch == current_quote:
            in_string = False
            current_quote = None
        i += 1

    if in_string and current_quote:
        # Find best insert position: before closing ')' or ']' or end of line
        rstripped = line.rstrip()
        # Insert before trailing closing brackets if present
        trailing = ""
        j = len(rstripped) - 1
        while j >= 0 and rstripped[j] in ')]':
            trailing = rstripped[j] + trailing
            j -= 1
        base = rstripped[:j + 1]
        repaired = base + current_quote + trailing
        return repaired, current_quote

    return None, None


def validate_and_repair_fix(code: str, fix: dict) -> tuple:
    if not fix or "changes" not in fix:
        return None, None

    # If the original file already has syntax errors we cannot use a whole-file
    # ast.parse to validate a single-line fix — it would always fail.
    # In that case we skip the strict gate and trust the per-line repair logic.
    original_already_broken = False
    try:
        ast.parse(code)
    except SyntaxError:
        original_already_broken = True

    lines = code.splitlines()
    modified_lines = lines[:]
    repaired_suggestion = None
    
    changes = sorted(fix["changes"], key=lambda c: c.get("line_start", 1), reverse=True)
    
    for change in changes:
        line_start = change.get("line_start", 1)
        line_end = change.get("line_end", line_start)
        replacement = change.get("replacement", "")
        
        # 1. Repair unterminated strings first
        repaired_str, quote_char = repair_unterminated_string(replacement)
        if repaired_str is not None:
            replacement = repaired_str
            change["replacement"] = replacement
            repaired_suggestion = f"Add closing {quote_char!r} to complete the string"

        # 2. Repair unbalanced parentheses
        open_p = replacement.count('(')
        close_p = replacement.count(')')
        if open_p > close_p:
            replacement = replacement.rstrip() + (")" * (open_p - close_p))
            change["replacement"] = replacement
            if not repaired_suggestion:
                if "print" in replacement:
                    repaired_suggestion = "Add closing ')' to complete the print statement"
                else:
                    repaired_suggestion = "Add closing ')' to complete the statement"
            
        if 1 <= line_start <= len(modified_lines):
            modified_lines[line_start-1 : line_end] = replacement.splitlines()
            
    simulated_code = "\n".join(modified_lines)

    if not original_already_broken:
        # Strict mode: original was clean → fix must also produce clean code.
        try:
            ast.parse(simulated_code)
        except SyntaxError:
            return None, None
    else:
        # Relaxed mode: original already had errors.
        # Discard the fix only if the replacement line itself is still broken
        # when parsed in isolation (avoids offering a fix that makes things worse).
        if len(changes) == 1:
            isolated = changes[0].get("replacement", "").strip()
            try:
                ast.parse(isolated)
            except SyntaxError:
                return None, None

    # If any repair was made, upgrade to the richer replace_line format.
    if repaired_suggestion and len(changes) == 1:
        c = changes[0]
        return make_structured_fix(c["line_start"], c["replacement"]), repaired_suggestion

    return fix, repaired_suggestion


def detect_unterminated_strings(code: str) -> List[Dict]:
    """Heuristic: find lines with unclosed string literals and generate a fix."""
    issues = []
    lines = code.splitlines()
    for i, line in enumerate(lines):
        line_num = i + 1
        repaired, quote_char = repair_unterminated_string(line)
        if repaired is None:
            continue

        # Build a candidate full code with the repair applied
        candidate_lines = lines[:]
        candidate_lines[i] = repaired
        try:
            ast.parse("\n".join(candidate_lines))
        except SyntaxError:
            # Fix didn't fully resolve — skip, validate_and_repair_fix will handle it
            pass

        issues.append({
            "line": line_num,
            "type": "syntax",
            "message": "Unterminated string literal",
            "root_cause": "String opened but not closed",
            "severity": "high",
            "confidence": 0.95,
            "source": ["heuristic"],
            "fix": make_structured_fix(line_num, repaired),
            "explanation": f"A string starting with {quote_char!r} on this line is never closed.",
            "suggestion": f"Add closing {quote_char!r} to complete the string"
        })
    return issues


def detect_runtime_risks(code: str) -> List[Dict]:
    issues = []
    lines = code.splitlines()
    for i, line in enumerate(lines):
        line_num = i + 1
        trimmed = line.strip()
        indent_str = line[:len(line) - len(trimmed)]
        
        # 1. Division by zero
        if "/ 0" in trimmed or "/0" in trimmed:
            fix = {
                "type": "patch",
                "changes": [
                    {
                        "line_start": line_num,
                        "line_end": line_num,
                        "replacement": line.replace("/ 0", "/ 1").replace("/0", "/1") + "  # FIXME: avoided hardcoded zero division"
                    }
                ]
            }
            print("[DEBUG] HEURISTIC FIX GENERATED:", fix)
            
            issues.append({
                "line": line_num,
                "type": "runtime",
                "message": "Division by zero",
                "root_cause": "Hardcoded division by zero",
                "severity": "high",
                "confidence": 0.8,
                "source": ["heuristic"],
                "fix": fix,
                "explanation": "Attempting to divide by zero will cause a ZeroDivisionError.",
                "suggestion": "Check the denominator to ensure it is not zero."
            })
            
        # 2. Infinite loops
        if "while True:" in trimmed or "while True" in trimmed:
            fix = {
                "type": "patch",
                "changes": [
                    {
                        "line_start": line_num,
                        "line_end": line_num,
                        "replacement": f"{line}\n{indent_str}    # TODO: add exit condition\n{indent_str}    break"
                    }
                ]
            }
            print("[DEBUG] HEURISTIC FIX GENERATED:", fix)
            
            issues.append({
                "line": line_num,
                "type": "runtime",
                "message": "Possible infinite loop",
                "root_cause": "Unconditional loop detected",
                "severity": "medium",
                "confidence": 0.5,
                "source": ["heuristic"],
                "fix": fix,
                "explanation": "A 'while True' loop was found. Ensure there is a 'break' condition.",
                "suggestion": "Add a break statement to prevent the loop from running forever."
            })
    return issues


def detect_logical_and_lint_issues(code: str) -> List[Dict]:
    issues = []
    lines = code.splitlines()
    
    # 1. Simple text-based heuristics
    for i, line in enumerate(lines):
        line_num = i + 1
        trimmed = line.strip()
        
        # Shadowing built-in
        import builtins
        match = re.match(r"^([a-zA-Z_]\w*)\s*=", trimmed)
        if match:
            var_name = match.group(1)
            if var_name in dir(builtins) and var_name not in ["_", "id", "type"]:
                issues.append({
                    "line": line_num,
                    "type": "lint",
                    "message": f"Shadows built-in name '{var_name}'",
                    "root_cause": f"Variable name overwrites a Python built-in",
                    "severity": "low",
                    "confidence": 0.9,
                    "source": ["heuristic"],
                    "fix": None,
                    "explanation": f"Using '{var_name}' as a variable hides the built-in function.",
                    "suggestion": "Rename the variable to something else."
                })
                
        # Mutable default argument
        if trimmed.startswith("def ") and ("=[]" in trimmed.replace(" ", "")):
            fix_line = line.replace("=[]", "=None").replace("= []", "= None")
            issues.append({
                "line": line_num,
                "type": "logical",
                "message": "Mutable default argument",
                "root_cause": "Default arguments evaluated once",
                "severity": "medium",
                "confidence": 0.95,
                "source": ["heuristic"],
                "fix": {
                    "type": "patch",
                    "changes": [{"line_start": line_num, "line_end": line_num, "replacement": fix_line}]
                },
                "explanation": "Using a mutable default argument like `[]` causes the same list to be shared across function calls.",
                "suggestion": "Replace `[]` with `None` and initialize it inside the function."
            })
            
        # Unsafe division
        if "/" in trimmed and not ("//" in trimmed or "/ 0" in trimmed or "/0" in trimmed):
            if "if " not in trimmed and "!= 0" not in trimmed:
                issues.append({
                    "line": line_num,
                    "type": "runtime",
                    "message": "Unsafe division",
                    "root_cause": "Division without zero check",
                    "severity": "medium",
                    "confidence": 0.6,
                    "source": ["heuristic"],
                    "fix": None,
                    "explanation": "Dividing by a variable without checking if it is zero can cause a ZeroDivisionError.",
                    "suggestion": "Check if denominator is zero before division."
                })
                
    # 2. AST-based heuristics
    try:
        tree = ast.parse(code)
        
        assigned_vars = {}
        used_vars = set()
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Name):
                if isinstance(node.ctx, ast.Store):
                    assigned_vars[node.id] = node.lineno
                elif isinstance(node.ctx, ast.Load):
                    used_vars.add(node.id)
                    
        # Unused variable
        for var, lineno in assigned_vars.items():
            if var not in used_vars and var != "_":
                issues.append({
                    "line": lineno,
                    "type": "lint",
                    "message": f"Unused variable '{var}'",
                    "root_cause": "Variable assigned but never used",
                    "severity": "low",
                    "confidence": 0.9,
                    "source": ["heuristic"],
                    "fix": None,
                    "explanation": f"The variable '{var}' is assigned a value but is never read.",
                    "suggestion": "Remove the variable if it's not needed."
                })
                
        # Missing return
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                has_return = any(isinstance(n, ast.Return) for n in ast.walk(node))
                if not has_return:
                    issues.append({
                        "line": node.lineno,
                        "type": "logical",
                        "message": f"Missing return in '{node.name}'",
                        "root_cause": "Missing return statement",
                        "severity": "medium",
                        "confidence": 0.7,
                        "source": ["heuristic"],
                        "fix": None,
                        "explanation": f"The function '{node.name}' has no return value.",
                        "suggestion": "Ensure the function returns a value if expected."
                    })
    except Exception:
        pass

    return issues


# ---------------------------------------------------------------------------
# LAYER 1 — Syntax detection (ast.parse)
# ---------------------------------------------------------------------------
_SYNTAX_FIX_KEYWORDS = frozenset(["if", "elif", "else", "for", "while", "def", "class", "with", "try", "except", "finally"])

def _syntax_fix(line_num: int, msg: str, line_content: str) -> Dict | None:
    """Return a structured fix for the most common syntax errors, or None."""
    trimmed = line_content.strip()

    # Missing colon
    if "expected ':'" in msg or "was expecting ':'" in msg:
        first_tok = trimmed.split()[0] if trimmed else ""
        if first_tok in _SYNTAX_FIX_KEYWORDS and not trimmed.endswith(":"):
            return make_structured_fix(line_num, line_content.rstrip() + ":")

    # Unterminated / mismatched quotes
    if "unterminated string" in msg.lower() or "EOL while scanning" in msg:
        repaired, _ = repair_unterminated_string(line_content)
        if repaired:
            return make_structured_fix(line_num, repaired)

    # Unclosed parenthesis / bracket
    if "was never closed" in msg or "unexpected EOF" in msg or "unmatched" in msg:
        for open_ch, close_ch in [("(", ")"), ("[", "]"), ("{", "}")]:
            diff = line_content.count(open_ch) - line_content.count(close_ch)
            if diff > 0:
                return make_structured_fix(line_num, line_content.rstrip() + close_ch * diff)

    return None


def detect_syntax_errors(code: str) -> List[Dict]:
    """
    LAYER 1 — Run ast.parse.  Returns a list with exactly one issue on the
    first SyntaxError found, or an empty list if the code is syntactically
    valid.  This is the *authoritative* syntax gate; it never silently fails.
    """
    try:
        ast.parse(code)
        return []
    except SyntaxError as e:
        line_num = e.lineno or 1
        msg      = e.msg or str(e)
        lines    = code.splitlines()
        line_content = lines[line_num - 1] if 0 < line_num <= len(lines) else ""

        fix = _syntax_fix(line_num, msg, line_content)

        explanation = f"Python cannot parse this line: {msg}"
        suggestion  = None
        if "expected ':'" in msg:
            suggestion = "Add ':' at the end of the statement to open the block."
        elif "unterminated string" in msg.lower():
            suggestion = "Close the string with a matching quote character."
        elif "was never closed" in msg or "unmatched" in msg:
            suggestion = "Balance the opening bracket/parenthesis with a matching closing one."
        elif "invalid syntax" in msg:
            suggestion = "Review the line for typos or missing characters."

        return [{
            "line"       : line_num,
            "type"       : "syntax",
            "message"    : msg,
            "root_cause" : "SyntaxError raised by Python AST parser",
            "severity"   : "high",
            "confidence" : 1.0,
            "source"     : ["ast"],
            "fix"        : fix,
            "explanation": explanation,
            "suggestion" : suggestion,
        }]


# ---------------------------------------------------------------------------
# LAYER 2 — Structural heuristics (regex, works without a valid AST)
# ---------------------------------------------------------------------------
_BLOCK_KW_RE  = re.compile(r'^(if|elif|else|for|while|def|class|with|try|except|finally)\b')
_CONTROL_RE   = re.compile(r'^(if|elif|for|while|with)\b')
_INVALID_OP   = re.compile(r'===|!==')
_WALRUS_LIKE  = re.compile(r'===')

def detect_structural_issues(code: str) -> List[Dict]:
    """
    LAYER 2 — Line-by-line scanner for structural problems that:
     - Can be detected without a valid AST
     - May produce multiple hits across the file (unlike ast.parse which stops at 1)
    Covers: missing colons, unclosed brackets, invalid operators.
    """
    issues: List[Dict] = []
    lines = code.splitlines()

    # Running paren / bracket / brace depth tracker
    paren_depth = brace_depth = bracket_depth = 0
    open_char_line: dict[str, int] = {}

    for i, line in enumerate(lines):
        line_num = i + 1
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # ── 1. Missing colon ──────────────────────────────────────────────────
        # A keyword line that ends without `:` (after ignoring trailing comments)
        no_comment = re.sub(r'#.*$', '', stripped).rstrip()
        if _BLOCK_KW_RE.match(no_comment) and not no_comment.endswith(":") and not no_comment.endswith(",") and not no_comment.endswith("\\"):
            # Make sure it's not a multi-line expression split across lines
            if _CONTROL_RE.match(no_comment) or no_comment.rstrip().endswith(")") or not no_comment.endswith("("):
                fix_line = line.rstrip() + ":"
                issues.append({
                    "line"       : line_num,
                    "type"       : "syntax",
                    "message"    : f"Missing ':' after '{stripped.split()[0]}' statement",
                    "root_cause" : "Block header missing colon",
                    "severity"   : "high",
                    "confidence" : 0.92,
                    "source"     : ["heuristic"],
                    "fix"        : make_structured_fix(line_num, fix_line),
                    "explanation": f"The '{stripped.split()[0]}' statement needs a ':' to open its body.",
                    "suggestion" : f"Add ':' at the end of line {line_num}.",
                })

        # ── 2. Invalid JS-style operators ─────────────────────────────────────
        if _INVALID_OP.search(no_comment):
            op  = "===" if "===" in no_comment else "!=="
            fix = no_comment.replace("===", "==").replace("!==", "!=")
            issues.append({
                "line"       : line_num,
                "type"       : "syntax",
                "message"    : f"Invalid operator '{op}' (JavaScript syntax)",
                "root_cause" : "JavaScript comparison operator used in Python",
                "severity"   : "high",
                "confidence" : 0.98,
                "source"     : ["heuristic"],
                "fix"        : make_structured_fix(line_num, line.replace("===", "==").replace("!==", "!=")),
                "explanation": f"'{op}' is a JavaScript operator. Python uses '{'==' if op == '===' else '!='}' instead.",
                "suggestion" : f"Replace '{op}' with '{'==' if op == '===' else '!='}'.",
            })

        # ── 3. Unclosed brackets/parens tracked across lines ──────────────────
        for ch in line:
            if   ch == '(': paren_depth   += 1; open_char_line.setdefault('(', line_num)
            elif ch == ')': paren_depth   -= 1; open_char_line.pop('(', None)
            elif ch == '[': bracket_depth += 1; open_char_line.setdefault('[', line_num)
            elif ch == ']': bracket_depth -= 1; open_char_line.pop('[', None)
            elif ch == '{': brace_depth   += 1; open_char_line.setdefault('{', line_num)
            elif ch == '}': brace_depth   -= 1; open_char_line.pop('{', None)

    # After all lines: flag still-open brackets
    pair = {'(': ')', '[': ']', '{': '}'}
    for open_ch, depth in [('(', paren_depth), ('[', bracket_depth), ('{', brace_depth)]:
        if depth > 0:
            orig_line = open_char_line.get(open_ch, 1)
            line_content = lines[orig_line - 1]
            diff = line_content.count(open_ch) - line_content.count(pair[open_ch])
            fixed = line_content.rstrip() + pair[open_ch] * max(diff, 1)
            issues.append({
                "line"       : orig_line,
                "type"       : "syntax",
                "message"    : f"Unclosed '{open_ch}' (never matched by '{pair[open_ch]}')",
                "root_cause" : f"Opening '{open_ch}' has no matching closing '{pair[open_ch]}'",
                "severity"   : "high",
                "confidence" : 0.90,
                "source"     : ["heuristic"],
                "fix"        : make_structured_fix(orig_line, fixed),
                "explanation": f"The '{open_ch}' opened on line {orig_line} is never closed.",
                "suggestion" : f"Add a closing '{pair[open_ch]}' to match the opening bracket.",
            })

    return issues


# ---------------------------------------------------------------------------
# Main Analysis Entry Point — 3-layer pipeline
# ---------------------------------------------------------------------------
ALLOWED_MESSAGE_IDS = {"E0001", "E0401", "E0601", "E0602"}

def analyze_code(code: str) -> Dict[str, List[Dict[str, Any]]]:
    print("\n[DEBUG] --- STARTING ANALYZE_CODE (3-layer pipeline) ---")

    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 1 — Syntax gate (ast.parse)
    # ═══════════════════════════════════════════════════════════════════════════
    syntax_issues = detect_syntax_errors(code)

    # Also run the regex-based structural scanner — it can find:
    #   • missing colons on control-flow lines
    #   • unclosed brackets
    #   • JS-style operators
    # regardless of whether ast.parse already failed.
    structural_issues = detect_structural_issues(code)

    print("\n[DEBUG] SYNTAX (ast) ISSUES:", syntax_issues)
    print("[DEBUG] STRUCTURAL ISSUES  :", structural_issues)

    # Merge structural into syntax list, deduped by (line, type)
    seen_keys: set[tuple] = {(s["line"], s["type"]) for s in syntax_issues}
    for s in structural_issues:
        key = (s["line"], s["type"])
        if key not in seen_keys:
            syntax_issues.append(s)
            seen_keys.add(key)

    # If ANY syntax issue was found, skip pylint + heuristics + AI and return
    # immediately. A broken file can't be meaningfully linted.
    if syntax_issues:
        print("[DEBUG] Syntax errors found — returning Layer 1 results immediately.")
        final = []
        for issue in syntax_issues:
            raw_msg   = issue.get("message", "")
            issue_key = f"{issue.get('type')}:{normalize(raw_msg)}"
            short_exp = make_short_explanation(
                issue.get("explanation", ""), issue.get("type", ""), raw_msg
            )
            fix = issue.get("fix")
            if fix:
                validated, repaired_sugg = validate_and_repair_fix(code, fix)
                fix = validated
                if repaired_sugg:
                    issue["suggestion"] = repaired_sugg

            # Look up BPEID records for Layer 1 syntax errors
            bpeid_rec = find_bpeid_record(None, raw_msg)

            err_item = {
                "issue_key"        : issue_key,
                "line"             : issue.get("line"),
                "error"            : raw_msg,
                "short_explanation": short_exp,
                "explanation"      : issue.get("explanation", ""),
                "fix"              : fix,
                "suggestion"       : filter_suggestion(issue.get("suggestion") or ""),
                "source"           : issue.get("source"),
                "type"             : issue.get("type"),
                "root_cause"       : issue.get("root_cause"),
                "severity"         : issue.get("severity"),
                "confidence"       : issue.get("confidence"),
            }

            if bpeid_rec:
                err_item["mental_model"] = bpeid_rec.get("mental_model")
                err_item["remediation"] = bpeid_rec.get("remediation")
                if bpeid_rec.get("explanation"):
                    eli5 = bpeid_rec["explanation"].get("eli5")
                    if eli5:
                        err_item["explanation"] = eli5
                        err_item["short_explanation"] = eli5

            final.append(err_item)
        return {"errors": final}

    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 2 — Heuristics (AST is valid, dig deeper)
    # ═══════════════════════════════════════════════════════════════════════════
    heuristic_issues = (
        detect_unterminated_strings(code)
        + detect_runtime_risks(code)
        + detect_logical_and_lint_issues(code)
    )
    intent_issues = detect_intent_mismatch(code)
    print("\n[DEBUG] HEURISTIC ISSUES:", heuristic_issues)
    print("[DEBUG] INTENT ISSUES    :", intent_issues)

    # ═══════════════════════════════════════════════════════════════════════════
    # LAYER 3 — Pylint (lint only — runs AFTER syntax passes)
    # ═══════════════════════════════════════════════════════════════════════════
    pylint_output = run_pylint(code)
    static_issues: List[Dict] = []
    try:
        parsed = json.loads(pylint_output)
    except Exception:
        parsed = []

    for err in parsed:
        if err.get("message-id") not in ALLOWED_MESSAGE_IDS:
            continue
        sym = err.get("symbol", "").lower()
        static_issues.append({
            "line"     : err.get("line"),
            "type"     : "syntax" if "syntax" in sym else "lint",
            "message"  : err.get("message", ""),
            "root_cause": None,
            "severity" : "high" if "error" in sym else "medium",
            "confidence": 1.0,
            "source"   : ["static"],
            "raw_err"  : err,
        })

    print("\n[DEBUG] PYLINT ISSUES:", static_issues)

    # ═══════════════════════════════════════════════════════════════════════════
    # AI Enhancement (optional, non-blocking)
    # ═══════════════════════════════════════════════════════════════════════════
    ai_insight  = generate_llm_insights(code, static_issues=static_issues)
    ai_issues: List[Dict] = []
    if ai_insight:
        g_fix  = ai_insight.get("fix")
        g_exp  = ai_insight.get("explanation")
        g_sugg = ai_insight.get("suggestion")
        for issue in (ai_insight.get("issues") or []):
            if isinstance(issue, dict):
                ai_issues.append({
                    "line"       : issue.get("line"),
                    "type"       : issue.get("type", "logical"),
                    "message"    : issue.get("message", ""),
                    "root_cause" : issue.get("root_cause"),
                    "severity"   : issue.get("severity", "medium"),
                    "confidence" : issue.get("confidence", 0.9),
                    "source"     : ["ai"],
                    "fix"        : g_fix,
                    "explanation": g_exp,
                    "suggestion" : g_sugg,
                })
    print(f"\n[DEBUG] MERGE INPUT — static:{len(static_issues)} heuristic:{len(heuristic_issues)} intent:{len(intent_issues)} ai:{len(ai_issues)}")

    # 5. Normalization and Deduplication
    merged_map = {}
    
    def get_key(issue):
        return (issue.get("line"), issue.get("type"))

    # PRIORITY 1: Static
    for s_issue in static_issues:
        key = get_key(s_issue)
        fallback = get_fallback_insight(code, s_issue["raw_err"])
        s_issue["explanation"] = fallback.get("explanation")
        s_issue["fix"] = fallback.get("fix")
        s_issue["suggestion"] = fallback.get("suggestion")
        merged_map[key] = s_issue

    # PRIORITY 2: Heuristics
    for h_issue in heuristic_issues:
        key = get_key(h_issue)
        if key in merged_map:
            existing = merged_map[key]
            if "heuristic" not in existing["source"]:
                existing["source"].append("heuristic")
            # Heuristic explanations/fixes supersede generic fallback
            existing["fix"] = h_issue.get("fix") or existing.get("fix")
            existing["explanation"] = h_issue.get("explanation") or existing.get("explanation")
            existing["suggestion"] = h_issue.get("suggestion") or existing.get("suggestion")
            existing["message"] = h_issue.get("message") or existing.get("message")
        else:
            merged_map[key] = h_issue

    # PRIORITY 3: Intent
    for i_issue in intent_issues:
        key = get_key(i_issue)
        if key in merged_map:
            existing = merged_map[key]
            if "intent" not in existing["source"]:
                existing["source"].append("intent")
            existing["fix"] = i_issue.get("fix") or existing.get("fix")
            existing["explanation"] = i_issue.get("explanation") or existing.get("explanation")
            existing["suggestion"] = i_issue.get("suggestion") or existing.get("suggestion")
            existing["message"] = i_issue.get("message") or existing.get("message")
        else:
            merged_map[key] = i_issue

    # PRIORITY 4: AI
    for ai_issue in ai_issues:
        key = get_key(ai_issue)
        if key in merged_map:
            existing = merged_map[key]
            if "ai" not in existing["source"]:
                existing["source"].append("ai")
            
            # AI enhances message and explanation
            if ai_issue.get("message"):
                existing["message"] = ai_issue.get("message")
            if ai_issue.get("explanation"):
                existing["explanation"] = ai_issue.get("explanation")
            
            # AI enhances but does NOT overwrite deterministic fixes
            if not existing.get("fix"):
                existing["fix"] = ai_issue.get("fix")
            
            # For suggestion: prefer heuristic, so only use AI if missing
            if not existing.get("suggestion"):
                existing["suggestion"] = ai_issue.get("suggestion")
        else:
            merged_map[key] = ai_issue

    print("\n[DEBUG] MERGED ISSUES (Map keys):")
    print(list(merged_map.keys()))

    # 6. Final Output Formatting (Maintaining Frontend Compatibility)
    errors_list = []
    for issue in merged_map.values():
        raw_msg = issue.get("message") or ""
        issue_key = f"{issue.get('type')}:{normalize(raw_msg)}"
        
        base_conf = issue.get("confidence")
        adjusted_conf = adjust_confidence(base_conf, issue_key) if base_conf is not None else None
        
        fix = issue.get("fix")
        filtered_suggestion = filter_suggestion(issue.get("suggestion"))
        
        if fix:
            validated_fix, repaired_sugg = validate_and_repair_fix(code, fix)
            if validated_fix:
                fix = validated_fix
                if repaired_sugg:
                    filtered_suggestion = repaired_sugg
            else:
                fix = None
        
        full_explanation = issue.get("explanation") or ""
        short_expl = make_short_explanation(full_explanation, issue.get("type", ""), raw_msg)

        # Retrieve linter message-id if it came from static pylint
        raw_err = issue.get("raw_err", {})
        message_id = raw_err.get("message-id") if raw_err else None
        
        # BPEID matching
        bpeid_rec = find_bpeid_record(message_id, raw_msg)

        err_item = {
            "issue_key": issue_key,
            "line": issue.get("line"),
            "error": raw_msg,  # Frontend expects "error"
            "short_explanation": short_expl,
            "explanation": full_explanation,      # detailed (kept for backward-compat)
            "fix": fix,
            "suggestion": filtered_suggestion,
            "source": issue.get("source"),
            "type": issue.get("type"),
            "root_cause": issue.get("root_cause"),
            "severity": issue.get("severity"),
            "confidence": adjusted_conf
        }

        # Inject BPEID details
        if bpeid_rec:
            err_item["mental_model"] = bpeid_rec.get("mental_model")
            err_item["remediation"] = bpeid_rec.get("remediation")
            if bpeid_rec.get("explanation"):
                eli5 = bpeid_rec["explanation"].get("eli5")
                if eli5:
                    err_item["explanation"] = eli5
                    err_item["short_explanation"] = eli5

        errors_list.append(err_item)

    # 7. Safety Rule: if all sources empty and AI was unavailable
    if not errors_list and not ai_insight:
        errors_list.append({
            "line": 0,
            "type": "system",
            "error": "Advanced analysis unavailable",
            "short_explanation": "Deep analysis is temporarily unavailable.",
            "explanation": "Static analysis found no issues. AI-based deep analysis is temporarily unavailable.",
            "suggestion": "Try again later for deeper insights.",
            "source": ["system"],
            "fix": None,
            "root_cause": None,
            "severity": "low",
            "confidence": None
        })

    # 8. Logging
    print(f"[Analyze] Static issues: {len(static_issues)}")
    print(f"[Analyze] AI issues: {len(ai_issues)}")
    print(f"[Analyze] Merged issues: {len(errors_list)}")

    final_response = {"errors": errors_list}
    print("\n[DEBUG] FINAL RESPONSE:")
    print(final_response)

    return final_response

