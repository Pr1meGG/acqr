import tempfile
import subprocess
import json
from services.explainer import explain_errors


def _check_syntax(code: str):
    """Return a list of syntax-like errors using Python's parser."""
    try:
        compile(code, "<string>", "exec")
        return []
    except SyntaxError as exc:  # pragma: no cover - simple passthrough
        line_no = exc.lineno or 1
        message = exc.msg or "Syntax error"
        return [
            {
                "line": line_no,
                "type": "error",
                "message-id": "E0001",
                "symbol": "syntax-error",
                "message": message,
                "source": "syntax",
            }
        ]


def run_pylint(code: str):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".py") as temp:
        temp.write(code.encode())
        temp_path = temp.name

    result = subprocess.run(
        ["pylint", temp_path, "--output-format=json"],
        capture_output=True,
        text=True
    )

    return result.stdout


def analyze_code(code: str):
    syntax_errors = _check_syntax(code)

    if syntax_errors:
        explained = explain_errors(syntax_errors, code)
        return {"errors": explained}

    pylint_output = run_pylint(code)

    try:
        parsed = json.loads(pylint_output)
    except Exception:
        parsed = []

    explained = explain_errors(parsed, code)

    return {"errors": explained}
