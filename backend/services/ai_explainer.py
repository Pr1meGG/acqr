import os
import json
import re
import ast
import asyncio
import hashlib
import time
from dotenv import load_dotenv
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

load_dotenv()

# Simple in-memory cache
# Structure: { "hash_key": {"data": dict, "timestamp": float} }
_AI_CACHE = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


def is_valid_python(code):
    try:
        if not code or not code.strip():
            return False
        ast.parse(code)
        return True
    except:
        return False


async def _generate_with_retry(model, prompt: str):
    delays = [1.5, 3.0, 4.5]
    max_attempts = len(delays) + 1

    for attempt in range(max_attempts):
        try:
            print(f"[AI Layer] Attempt {attempt + 1}/{max_attempts}...")
            response = await model.generate_content_async(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            return response.text
        except Exception as e:
            error_str = str(e).lower()
            is_transient = (
                "429" in error_str or "503" in error_str or "504" in error_str or
                "rate limit" in error_str or "quota" in error_str or "unavailable" in error_str or
                isinstance(e, (google_exceptions.ResourceExhausted, google_exceptions.ServiceUnavailable, google_exceptions.RetryError))
            )
            
            print(f"[AI Layer] Error type: {type(e).__name__} - {e}")
            
            if is_transient and attempt < len(delays):
                delay = delays[attempt]
                print(f"[AI Layer] Transient error detected. Retrying in {delay}s...")
                await asyncio.sleep(delay)
            else:
                if is_transient:
                    print("[AI Layer] Max retries reached. Fallback triggered.")
                else:
                    print("[AI Layer] Non-transient error. Failing fast. Fallback triggered.")
                return None
                
    return None


def generate_llm_insights(code: str, static_issues: list = None):
    # Generate cache key using SHA256 based ONLY on the code
    cache_key = hashlib.sha256(code.encode("utf-8")).hexdigest()

    if cache_key in _AI_CACHE:
        cached_entry = _AI_CACHE[cache_key]
        if time.time() - cached_entry["timestamp"] < CACHE_TTL_SECONDS:
            print("[AI Cache] HIT - Returning cached AI response.")
            return cached_entry["data"]
        else:
            print("[AI Cache] EXPIRED - Evicting stale entry.")
            del _AI_CACHE[cache_key]

    print("[AI Cache] MISS - Fetching new AI response...")

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        print("[AI Layer] API Key missing.")
        return None

    genai.configure(api_key=api_key)
    # Using the updated model for better performance
    model = genai.GenerativeModel("gemini-2.5-flash")

    static_issues_text = ""
    if static_issues:
        static_issues_text = "Static analysis found the following issues (may be incomplete or partially incorrect):\n"
        for issue in static_issues:
            static_issues_text += f"- Line {issue.get('line')}: {issue.get('message')} (Type: {issue.get('type', 'syntax')})\n"
        static_issues_text += "Use this only as a hint. Independently analyze the code for additional issues.\n"

    prompt = f"""You are an expert Python code reviewer and debugger.

Your task is to deeply analyze the given Python code, identify issues, determine the real root cause, generate a precise minimal fix, and explain it like a senior developer.
{static_issues_text}
Return ONLY valid JSON. No markdown, no backticks, no extra text.

---

Return JSON in this exact format:

{{
"issues": [
{{
"type": "syntax | runtime | logical | lint",
"message": "clear and specific description",
"root_cause": "actual underlying cause of the issue",
"line": number,
"severity": "low | medium | high",
"confidence": 0.0-1.0
}}
],
"fix": {{
"type": "patch",
"changes": [
{{
"line_start": number,
"line_end": number,
"replacement": "corrected line of code"
}}
]
}},
"explanation": "clear, concise explanation of what was wrong and why the fix works",
"suggestion": "practical improvement suggestion based on best practices"
}}

---

STRICT RULES:

* Think step-by-step internally before answering, but DO NOT output reasoning steps
* DO NOT rewrite the entire code
* ONLY modify necessary lines
* Preserve indentation EXACTLY
* Maintain original logic unless it is incorrect
* Line numbers must match the input
* Fix must directly resolve the root cause, not just symptoms
* If multiple issues exist, return all of them
* If unsure, choose the safest minimal fix
* NEVER return empty fields
* NEVER wrap JSON in markdown

---

REASONING GUIDELINES:

* Distinguish between syntax, runtime, and logical errors
* Prefer minimal, surgical fixes over large rewrites
* Do not introduce new complexity
* Avoid unnecessary refactoring unless required to fix the issue
* If a variable/function is undefined, identify where it should come from
* If division by zero or similar, correct logic safely

---

Now analyze this code:

{code}
"""

    try:
        raw_text = asyncio.run(_generate_with_retry(model, prompt))

        if not raw_text:
            return None

        raw_text = raw_text.strip()

        # remove markdown just in case
        cleaned = re.sub(r"^```json\s*", "", raw_text)
        cleaned = re.sub(r"\s*```$", "", cleaned).strip()

        data = json.loads(cleaned)

        # Store in cache after a successful response
        _AI_CACHE[cache_key] = {"data": data, "timestamp": time.time()}

        # We are returning the raw parsed JSON to the frontend
        return data

    except Exception as e:
        print("[AI ERROR]", e)
        return None