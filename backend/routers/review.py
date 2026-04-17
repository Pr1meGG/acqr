from fastapi import APIRouter
from models.schemas import CodeRequest
from services.analyzer import analyze_code

router = APIRouter()

@router.post("/analyze")
def analyze(request: CodeRequest):
    return analyze_code(request.code)