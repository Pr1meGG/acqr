from fastapi import APIRouter
from models.schemas import CodeRequest, FeedbackRequest
from services.analyzer import analyze_code
from services.executor import run_python_code
from services.feedback_engine import save_feedback

router = APIRouter()

@router.post("/analyze")
def analyze(request: CodeRequest):
    return analyze_code(request.code)

@router.post("/run-code")
def run_code(request: CodeRequest):
    return run_python_code(request.code)

@router.post("/feedback")
def feedback(request: FeedbackRequest):
    save_feedback(request.issue_key, request.was_correct)
    return {"status": "success", "message": "Feedback recorded."}