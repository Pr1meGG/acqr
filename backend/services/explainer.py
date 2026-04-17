ERROR_MAP = {
    "E1101": "You're trying to access something that doesn't exist on an object.",
    "W0611": "You imported something but never used it.",
    "C0114": "Your file is missing a docstring.",
}


def expand(msg):
    return f"{msg} This usually happens when you forget something or make a small mistake."


def explain_errors(errors):
    result = []

    for err in errors:
        code = err.get("message-id", "UNKNOWN")

        base = ERROR_MAP.get(
            code,
            "There might be something wrong in your code."
        )

        result.append({
            "line": err.get("line"),
            "type": err.get("type"),
            "message": err.get("message"),
            "explanation": expand(base)
        })

    return result