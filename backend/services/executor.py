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

import asyncio
from fastapi import WebSocket, WebSocketDisconnect

async def run_python_interactive(code: str, websocket: WebSocket):
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode="w", encoding="utf-8") as tmp:
            tmp.write(code)
            tmp_path = tmp.name

        process = await asyncio.create_subprocess_exec(
            sys.executable, "-u", tmp_path,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT
        )

        async def read_stdout():
            try:
                while True:
                    data = await process.stdout.read(1024)
                    if not data:
                        break
                    await websocket.send_text(data.decode("utf-8", errors="replace"))
            except Exception:
                pass

        async def read_websocket():
            try:
                while True:
                    data = await websocket.receive_text()
                    if data and process.returncode is None:
                        process.stdin.write(data.encode("utf-8"))
                        await process.stdin.drain()
            except WebSocketDisconnect:
                pass
            except Exception:
                pass

        stdout_task = asyncio.create_task(read_stdout())
        ws_task = asyncio.create_task(read_websocket())

        try:
            await asyncio.wait_for(process.wait(), timeout=60)
        except asyncio.TimeoutError:
            process.kill()
            try:
                await websocket.send_text("\n\n[TimeoutError: Execution exceeded 60s limit.]")
            except:
                pass

        await asyncio.sleep(0.1)
        stdout_task.cancel()
        ws_task.cancel()
        
        try:
            await websocket.send_text("\n[Process exited]")
            await websocket.close()
        except:
            pass

    except Exception as e:
        try:
            await websocket.send_text(f"\nSystemError: {str(e)}")
            await websocket.close()
        except:
            pass
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

