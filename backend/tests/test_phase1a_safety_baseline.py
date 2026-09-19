"""Non-writing API safety baseline for Phase 1A.

These tests intentionally exercise only ``/analyze`` with a syntax error, so
the request remains inside the deterministic AST path and does not invoke the
optional AI or any user-code execution route.
"""

from pathlib import Path
import sys

import pytest
from pydantic import ValidationError


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from routers import review
from models.schemas import CodeRequest


NORMALIZED_ISSUE_FIELDS = {
    "issue_key",
    "line",
    "error",
    "short_explanation",
    "explanation",
    "fix",
    "suggestion",
    "source",
    "type",
    "root_cause",
    "severity",
    "confidence",
}


def test_analyze_returns_a_normalized_syntax_issue_response():
    payload = review.analyze(CodeRequest(code="if True\n    pass"))

    assert set(payload) == {"errors"}
    assert isinstance(payload["errors"], list)
    assert payload["errors"]

    issue = payload["errors"][0]
    assert NORMALIZED_ISSUE_FIELDS <= set(issue)
    assert issue["line"] == 1
    assert issue["type"] == "syntax"
    assert issue["severity"] == "high"
    assert issue["source"]
    assert "expected ':'" in issue["error"]


def test_analyze_request_validation_identifies_the_missing_code_field():
    with pytest.raises(ValidationError) as exc_info:
        CodeRequest.model_validate({})

    error = exc_info.value.errors()[0]
    assert error["loc"] == ("code",)
    assert {"type", "msg", "input"} <= set(error)


def test_analyze_endpoint_does_not_call_the_execution_handler(monkeypatch):
    execution_calls = []

    def fail_if_called(*args, **kwargs):
        execution_calls.append((args, kwargs))
        raise AssertionError("/analyze must not invoke run_python_code")

    monkeypatch.setattr(review, "run_python_code", fail_if_called)

    payload = review.analyze(CodeRequest(code="if True\n    pass"))

    assert payload["errors"]
    assert execution_calls == []
