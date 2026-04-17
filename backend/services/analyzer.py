import tempfile
import subprocess
import json
from services.explainer import explain_errors


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
    pylint_output = run_pylint(code)

    try:
        parsed = json.loads(pylint_output)
    except:
        parsed = []

    explained = explain_errors(parsed)

    return {
        "errors": explained
    }