import os
from dotenv import load_dotenv

import google.generativeai as genai


GEMINI_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
]
FALLBACK_EXPLANATION = (
    "I could not get an AI response right now. "
    "In simple terms, this error means Python found something it could not understand. "
    "This often happens due to a typo, missing symbol, or using a variable before defining it. "
    "Check the reported line carefully, fix one issue at a time, and run the code again."
)

load_dotenv()


def _build_prompt(code: str, error: str) -> str:
    return f"""
Explain this Python error in simple terms:

Error: {error}
Code:
{code}

Explain:

* what is wrong
* why it happens
* how to fix it
"""


def explain_with_gemini(code: str, error: str):
    print("[Gemini] explain_with_gemini called")
    api_key = os.getenv("GEMINI_API_KEY")
    print(f"[Gemini] API key loaded: {bool(api_key)}")

    if api_key is None or not api_key.strip():
        print("[Gemini] GEMINI_API_KEY is missing")
        return {
            "ok": False,
            "explanation": "API key not configured",
            "error": "missing_api_key",
        }

    prompt = _build_prompt(code, error)

    try:
        print("[Gemini] Configuring client and generating content")
        genai.configure(api_key=api_key)
        for model_name in GEMINI_MODELS:
            try:
                print(f"[Gemini] Trying model: {model_name}")
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                text = (response.text or "").strip()
                if text:
                    print(f"[Gemini] Model succeeded: {model_name}")
                    return {"ok": True, "explanation": text, "error": ""}
                print(f"[Gemini] Model returned empty response: {model_name}")
            except Exception as model_exc:
                print(f"[Gemini] Model failed {model_name}: {model_exc}")

        print("[Gemini] All configured models failed")
        return {
            "ok": False,
            "explanation": FALLBACK_EXPLANATION,
            "error": "all_models_failed",
        }
    except Exception as exc:
        print(f"[Gemini] Request failed: {exc}")
        return {
            "ok": False,
            "explanation": FALLBACK_EXPLANATION,
            "error": "gemini_failed",
        }


def explain_text_with_gemini(code: str, error: str) -> str:
    """Helper for direct text return use-cases."""
    result = explain_with_gemini(code, error)
    return result["explanation"]