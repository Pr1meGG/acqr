import re


ERROR_RULES = {
    "E0602": {
        "explanation": "You're trying to use a variable that hasn't been defined.",
        "why_it_happens": "Python needs variables to be assigned before use.",
        "fix": "Define the variable before using it, or correct the variable name if it is misspelled.",
        "example": "x = 10\nprint(x)",
    },
    "C0114": {
        "explanation": "This file does not have a module docstring at the top.",
        "why_it_happens": "Docstrings help explain what a file is for, and style tools expect them.",
        "fix": "Add a short triple-quoted description at the top of the file.",
        "example": '"""Utility functions for math operations."""',
    },
    "C0115": {
        "explanation": "This class is missing a docstring.",
        "why_it_happens": "Class docstrings explain what a class represents and how it should be used.",
        "fix": "Add a short triple-quoted summary inside the class.",
        "example": 'class User:\n    """Represents a user account."""',
    },
    "C0116": {
        "explanation": "This function is missing a docstring.",
        "why_it_happens": "Function docstrings explain inputs, behavior, and output for readers.",
        "fix": "Add a short triple-quoted description as the first line inside the function.",
        "example": 'def add(a, b):\n    """Return the sum of two numbers."""\n    return a + b',
    },
    "E0001": {
        "explanation": "There is a syntax issue, so Python cannot read this code correctly.",
        "why_it_happens": "Python requires exact punctuation and structure, such as colons and matching brackets.",
        "fix": "Check the line for missing punctuation, mismatched quotes/brackets, or incomplete statements.",
        "example": "if x > 5:\n    print(x)",
    },
}


def _unknown_error_profile(message):
    if re.search(r"undefined variable", message, re.IGNORECASE):
        return ERROR_RULES["E0602"]

    if re.search(r"missing.*docstring", message, re.IGNORECASE):
        return {
            "explanation": "A docstring is missing in this part of your code.",
            "why_it_happens": "Docstrings are short text notes that explain what code does.",
            "fix": "Add a short triple-quoted description to explain purpose and behavior.",
            "example": 'def greet(name):\n    """Return a greeting message for a name."""\n    return f"Hello, {name}"',
        }

    if re.search(r"syntax", message, re.IGNORECASE):
        return ERROR_RULES["E0001"]

    return {
        "explanation": "Something in this part of the code is not valid.",
        "why_it_happens": "Small mistakes in names, structure, or punctuation can break the code.",
        "fix": "Read the message and line carefully, then correct the code step by step.",
        "example": "# Example pattern\nvalue = 42\nprint(value)",
    }


def _build_explanation(err):
    code = err.get("message-id", "UNKNOWN")
    message = err.get("message", "")
    profile = ERROR_RULES.get(code) or _unknown_error_profile(message)

    return {
        "line": err.get("line"),
        "type": err.get("type"),
        "message": message,
        "explanation": profile["explanation"],
        "why_it_happens": profile["why_it_happens"],
        "fix": profile["fix"],
        "example": profile["example"],
    }


def explain_errors(errors):
    return [_build_explanation(err) for err in errors]