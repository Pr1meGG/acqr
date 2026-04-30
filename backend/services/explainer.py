import re


ERROR_RULES = {
    "E0001": {
        "what_happened": "You wrote code that Python can't understand.",
        "why": "There's a mistake in the code structure, like a missing bracket or colon.",
        "what_to_do": "Check the line for missing parts and add them.",
        "example": 'if age > 18:\n    print("Adult")',
    },
    "E0401": {
        "what_happened": "You tried to import a module that doesn't exist.",
        "why": "The module name is wrong or it's not installed.",
        "what_to_do": "Fix the spelling or install the module with pip.",
        "example": 'import math\nprint(math.sqrt(4))',
    },
    "E0402": {
        "what_happened": "You used a relative import that Python can't find.",
        "why": "Relative imports need the right file setup.",
        "what_to_do": "Use a full import path instead.",
        "example": 'from mypackage import helper',
    },
    "E0403": {
        "what_happened": "You used a relative import that doesn't work here.",
        "why": "The relative path is wrong for this location.",
        "what_to_do": "Change to an absolute import.",
        "example": 'import mypackage.helper',
    },
    "E0413": {
        "what_happened": "There's a problem with how you imported something.",
        "why": "The import statement has an issue.",
        "what_to_do": "Check the import line and fix it.",
        "example": 'from math import sqrt\nprint(sqrt(9))',
    },
    "E0601": {
        "what_happened": "You used a variable before giving it a value.",
        "why": "The variable doesn't have a value yet at that point.",
        "what_to_do": "Move the assignment before the use.",
        "example": 'x = 5\nprint(x)',
    },
    "E0602": {
        "what_happened": "You tried to use a variable that doesn't exist.",
        "why": "The name was never defined or is spelled wrong.",
        "what_to_do": "Define the variable first or fix the spelling.",
        "example": 'name = "Bob"\nprint(name)',
    },
}


def _unknown_error_profile(message):
    if re.search(r"undefined variable", message, re.IGNORECASE):
        return ERROR_RULES["E0602"]

    if re.search(r"syntax", message, re.IGNORECASE):
        return ERROR_RULES["E0001"]

    if re.search(r"import", message, re.IGNORECASE):
        return ERROR_RULES["E0401"]

    return {
        "what_happened": "Something went wrong in your code.",
        "why": "There's an error that needs fixing.",
        "what_to_do": "Look at the message and try to fix it.",
        "example": 'print("Hello")',
    }


def _build_explanation(err):
    code = err.get("message-id", "UNKNOWN")
    message = err.get("message", "")
    profile = ERROR_RULES.get(code) or _unknown_error_profile(message)

    return {
        "line": err.get("line"),
        "message": message,
        "what_happened": profile["what_happened"],
        "why": profile["why"],
        "what_to_do": profile["what_to_do"],
        "example": profile["example"],
    }


def explain_errors(errors):
    return [_build_explanation(err) for err in errors]


def explain_errors(errors):
    return [_build_explanation(err) for err in errors]


def build_local_explanation_from_message(message: str) -> str:
    profile = _unknown_error_profile(message or "")
    return (
        f"What is wrong: {profile['explanation']}\n\n"
        f"In simple terms: {profile['eli5']}\n\n"
        f"How to fix it: {profile['fix']}\n\n"
        f"Example (corrected pattern):\n{profile['example']}"
    )
