from pydantic import BaseModel
from typing import Optional

class CodeRequest(BaseModel):
    code: str


class AIExplainRequest(BaseModel):
    code: str
    error: Optional[str] = None
    message: Optional[str] = None

class FeedbackRequest(BaseModel):
    issue_key: str
    was_correct: bool