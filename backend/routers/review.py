from fastapi import APIRouter
from models.schemas import AIExplainRequest, CodeRequest
from services.analyzer import analyze_code
from services.ai_explainer import explain_with_gemini
from services.explainer import build_local_explanation_from_message

router = APIRouter()

@router.post("/analyze")
def analyze(request: CodeRequest):
    return analyze_code(request.code)


@router.post("/analyze/ai-explain")
def ai_explain(request: AIExplainRequest):
    error_text = request.error or request.message or "Unknown error"
    ai_result = explain_with_gemini(request.code, error_text)
    return {
        "ai_explanation": ai_result["explanation"],
        "error": ai_result["error"],
        "ok": ai_result["ok"],
    }


@router.post("/explain-more")
def explain_more(request: AIExplainRequest):
    error_text = request.error or request.message or "Unknown error"
    ai_result = explain_with_gemini(request.code, error_text)
    if ai_result["ok"]:
        return {
            "explanation": ai_result["explanation"],
            "source": "gemini",
        }

    local_explanation = build_local_explanation_from_message(error_text)
    return {
        "explanation": local_explanation,
        "source": "local",
    }