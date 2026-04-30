import subprocess
import sys
import tempfile
import os

def run_python_code(code: str):
    """
    Executes Python code safely in a subprocess and captures output.
    Note: In a production environment, this should be sandboxed.
    """
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode="w", encoding="utf-8") as tmp:
            tmp.write(code)
            tmp_path = tmp.name
        
        # Run the code using the same python interpreter
        result = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True,
            text=True,
            timeout=5  # 5 second timeout to prevent infinite loops
        )
        
        return {
            "output": result.stdout,
            "error": result.stderr
        }
    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": "Execution timed out (5s limit)."
        }
    except Exception as e:
        return {
            "output": "",
            "error": str(e)
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
