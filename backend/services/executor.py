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
        
        # Sanitize error output to be clean and educational
        stderr = result.stderr
        if stderr and "/tmp/tmp" in stderr:
            # Try to extract just the final error message (last line that is not empty)
            lines = [line.strip() for line in stderr.splitlines() if line.strip()]
            if lines:
                # The last line of a Python traceback is usually the exception itself
                cleaned_error = lines[-1]
                stderr = cleaned_error
            
        return {
            "output": result.stdout,
            "error": stderr
        }
    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": "TimeoutError: Execution exceeded 5s limit."
        }
    except Exception as e:
        return {
            "output": "",
            "error": f"SystemError: {str(e)}"
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
