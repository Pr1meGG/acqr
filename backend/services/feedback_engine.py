import json
import os
import fcntl

FEEDBACK_FILE = "feedback_store.json"

def _load_store() -> dict:
    if not os.path.exists(FEEDBACK_FILE):
        return {}
    try:
        with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}

def _save_store(data: dict):
    with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
        # Simple file lock for concurrency safety
        try:
            fcntl.flock(f, fcntl.LOCK_EX)
            json.dump(data, f, indent=4)
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)

def save_feedback(issue_key: str, was_correct: bool):
    data = _load_store()
    
    if issue_key not in data:
        data[issue_key] = {"total": 0, "correct": 0}
        
    data[issue_key]["total"] += 1
    if was_correct:
        data[issue_key]["correct"] += 1
        
    _save_store(data)

def get_feedback_stats(issue_key: str) -> dict:
    data = _load_store()
    stats = data.get(issue_key, {"total": 0, "correct": 0})
    total = stats["total"]
    correct = stats["correct"]
    accuracy = correct / total if total > 0 else 0.0
    return {
        "total": total,
        "correct": correct,
        "accuracy": accuracy
    }

def adjust_confidence(base_confidence: float, issue_key: str) -> float:
    if base_confidence is None:
        return None
        
    stats = get_feedback_stats(issue_key)
    total = stats["total"]
    
    # Require minimum sample threshold
    if total < 5:
        return base_confidence
        
    accuracy = stats["accuracy"]
    # Penalty and boost formula: 0.5 + accuracy
    # Ex: if accuracy is 0.2 -> multiplier is 0.7 (penalty)
    # Ex: if accuracy is 0.9 -> multiplier is 1.4 (boost)
    adjusted_conf = base_confidence * (0.5 + accuracy)
    
    return min(adjusted_conf, 1.0)
