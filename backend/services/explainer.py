import re
from typing import Dict, Optional, Tuple


def _shorten(text: str) -> str:
    return text.strip()[:320]


def _detect_fix_for_syntax(message: str, line_text: str) -> Optional[Tuple[str, str, str]]:
    lower = message.lower()
    if "closing parenthesis" in lower or "unexpected eof while parsing" in lower:
        if line_text.strip().endswith("(") or line_text.count("(") > line_text.count(")"):
            return line_text, line_text + ")", "Added the missing closing parenthesis."
    if "closing bracket" in lower:
        if line_text.count("[") > line_text.count("]"):
            return line_text, line_text + "]", "Added the missing closing bracket."
    if "closing brace" in lower:
        if line_text.count("{") > line_text.count("}"):
            return line_text, line_text + "}", "Added the missing closing brace."
    if "quote" in lower or "string literal" in lower:
        single = line_text.count("'")
        double = line_text.count('"')
        if single % 2 != 0:
            return line_text, line_text + "'", "Closed the missing quote to finish the string."
        if double % 2 != 0:
            return line_text, line_text + '"', "Closed the missing quote to finish the string."
    if "expected ':'" in lower or "expected an indented block" in lower:
        stripped = line_text.rstrip()
        if not stripped.endswith(":"):
            return line_text, stripped + ":", "Added the missing colon."
    return None


def _detect_fix_for_e0602(line_text: str, message: str, lines: list, line_no: int) -> Optional[Tuple[str, str, str]]:
    match = re.search(r"'([^']+)'", message)
    undefined = match.group(1) if match else None
    if undefined:
        # If the variable is assigned later, suggest moving assignment above.
        for idx, candidate in enumerate(lines):
            if re.match(rf"\s*{re.escape(undefined)}\s*=", candidate) and idx + 1 > line_no:
                fixed = f"{candidate}\n{line_text}"
                return line_text, fixed, "Move the variable assignment above its first use."
        return line_text, f"{undefined} = None\n{line_text}", "Define the variable before using it."
    return None


def _detect_fix_for_e0401(line_text: str, message: str) -> Optional[Tuple[str, str, str]]:
    match = re.search(r"Unable to import '(.*?)'", message)
    missing = match.group(1) if match else None
    if missing:
        suggestion = f"import {missing}"
        return line_text, suggestion, "Add an import for the missing module (install it if not present)."
    return None


def _detect_fix_for_type_mismatch(line_text: str, message: str) -> Optional[Tuple[str, str, str]]:
    if "+" not in line_text:
        return None

    parts = line_text.split("+")
    if len(parts) != 2:
        return None

    left, right = parts
    has_quote = bool(re.search(r"[\"']", line_text))
    has_digit = bool(re.search(r"\d", line_text))

    if has_quote and has_digit:
        if re.search(r"\d", right):
            return line_text, f"{left.strip()} + str({right.strip()})", "Convert the number to a string before concatenation."
        if re.search(r"\d", left):
            return line_text, f"str({left.strip()}) + {right.strip()}", "Convert the number to a string before concatenation."

    lower_msg = message.lower()
    if "str" in lower_msg and "int" in lower_msg:
        return line_text, f"str({left.strip()}) + str({right.strip()})", "Convert values to strings before adding."

    return None


def generate_fix(err: Dict, code: str) -> Optional[Dict[str, Optional[str]]]:
    line_no = err.get("line")
    lines = code.splitlines()
    original_line = lines[line_no - 1] if line_no and 1 <= line_no <= len(lines) else ""
    message_id = err.get("message-id") or ""
    message = err.get("message") or ""

    fixed_line = None
    explanation = None

    if message_id == "E0001":
        maybe = _detect_fix_for_syntax(message, original_line)
        if maybe:
            original_line, fixed_line, explanation = maybe
    elif message_id == "E0602":
        maybe = _detect_fix_for_e0602(original_line, message, lines, line_no or 0)
        if maybe:
            original_line, fixed_line, explanation = maybe
    elif message_id == "E0401":
        maybe = _detect_fix_for_e0401(original_line, message)
        if maybe:
            original_line, fixed_line, explanation = maybe
    elif message_id.startswith("E") and "unsupported operand type" in message.lower():
        maybe = _detect_fix_for_type_mismatch(original_line, message)
        if maybe:
            original_line, fixed_line, explanation = maybe

    if not fixed_line:
        return None

    return {
        "original_line": _shorten(original_line) or None,
        "fixed_line": _shorten(fixed_line) if fixed_line else None,
        "explanation": explanation,
    }


def _short_explanation(message: str, fallback: str) -> str:
    if not message:
        return fallback
    lowered = message.lower()
    if "undefined variable" in lowered:
        return "This line uses a name that was never defined."
    if "import" in lowered and "unable" in lowered:
        return "Python cannot find the module you tried to import."
    if "unsupported operand type" in lowered:
        return "The operation mixes values of incompatible types."
    if "syntax" in lowered or "invalid" in lowered:
        return "The code is not valid Python syntax yet."
    return fallback


def _eli5(message: str, fallback: str) -> str:
    if "undefined variable" in message.lower():
        return "You used a name before telling Python what it is."
    if "import" in message.lower():
        return "Python looked for a library but could not find it."
    if "unsupported operand type" in message.lower():
        return "You tried to mix text and numbers without converting them."
    return fallback


def _why(message: str, fallback: str) -> str:
    lowered = message.lower()
    if "undefined variable" in lowered:
        return "You need to create or spell the name before using it."
    if "import" in lowered:
        return "Python could not locate the module you requested."
    if "unsupported operand type" in lowered:
        return "The operation mixes incompatible types (like text with numbers)."
    if "syntax" in lowered or "invalid" in lowered:
        return "Python needs complete punctuation (quotes, brackets, colons)."
    return fallback


def _example_for(message_id: str) -> Optional[str]:
    if message_id == "E0001":
        return "if x > 5:\n    print(x)"
    if message_id == "E0602":
        return "x = 10\nprint(x)"
    if message_id == "E0401":
        return "import math\nprint(math.pi)"
    if message_id.startswith("E"):
        return 'print("5" + str(2))'
    return None


def _build_explanation(err: Dict, code: str):
    message = err.get("message", "")
    base_explanation = _short_explanation(message, "The code on this line is not valid.")
    fix_data = generate_fix(err, code)
    err_type = err.get("type") or "Error"
    message_id = err.get("message-id") or ""

    payload = {
        "line": err.get("line"),
        "type": str(err_type).capitalize(),
        "message": message,
        "explanation": base_explanation,
        "eli5": _eli5(message, base_explanation),
        "why": _why(message, base_explanation),
        "why_it_happens": _why(message, base_explanation),
        "fix": fix_data.get("explanation") if fix_data else None,
        "fix_data": None,
        "example": _example_for(message_id),
    }

    if fix_data:
        payload["fix_data"] = {
            "original_line": fix_data.get("original_line"),
            "fixed_line": fix_data.get("fixed_line"),
        }

    return payload


def explain_errors(errors, code: str):
    return [_build_explanation(err, code) for err in errors]
