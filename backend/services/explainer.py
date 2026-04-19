import re


ERROR_RULES = {
    "E0602": {
        "explanation": (
            "Python looks up the name you used and cannot find any value tied to it yet. "
            "That usually means a typo in the name, or you are using the variable before the line where you first assign it."
        ),
        "eli5": "You're trying to use something that doesn't exist yet.",
        "fix": (
            "Define the variable before you use it with `name = value`, or fix the spelling "
            "so it matches the name you created earlier."
        ),
        "example": 'score = 100\nprint(score)',
    },
    "C0114": {
        "explanation": (
            "A new reader (or future you) opens this file and should immediately see what the module is for. "
            "Style checkers expect a short triple-quoted description right at the top, like a title card for the file."
        ),
        "eli5": "It's like a book with no title on the cover — nobody knows what story they opened.",
        "fix": "Add a one-line module docstring as the first statement in the file (triple quotes, then a clear purpose).",
        "example": '"""Validate and normalize user signup input."""',
    },
    "C0115": {
        "explanation": (
            "A class bundles data and behavior; a class docstring is the friendly sign on the door that says what this "
            "kind of object represents and when someone should use it."
        ),
        "eli5": "A class is a blueprint; without a note on it, people guess wrong about what you're building.",
        "fix": "Put a short triple-quoted string as the first indented line inside the class body.",
        "example": 'class BankAccount:\n    """One customer\'s balance and transaction history."""\n    pass',
    },
    "C0116": {
        "explanation": (
            "Functions do real work; a docstring tells a human what goes in, what happens, and what comes out — "
            "without making them read every line of the body first."
        ),
        "eli5": "It's a tool with no label on the handle — others have to guess what the tool does.",
        "fix": "Add a triple-quoted one-liner as the first statement inside the function (right after the `def` line).",
        "example": 'def square(n):\n    """Return n multiplied by itself."""\n    return n * n',
    },
    "E0001": {
        "explanation": (
            "Syntax is the grammar of Python. When something is missing or mismatched — a colon, a parenthesis, a quote — "
            "the interpreter cannot even start executing; it stops at the broken sentence."
        ),
        "eli5": "It's like a recipe with a word missing so the cook cannot even begin — the instructions don't parse.",
        "fix": "Compare the flagged line with a small working pattern: look for missing `:`, `)`, `]`, `}`, or unfinished strings.",
        "example": 'if total > 0:\n    print("ok")',
    },
}


def _unknown_error_profile(message):
    if re.search(r"undefined variable", message, re.IGNORECASE):
        return ERROR_RULES["E0602"]

    if re.search(r"missing.*docstring", message, re.IGNORECASE):
        return {
            "explanation": (
                "This location should have a short docstring — a human-readable note in triple quotes that says "
                "what this piece of code is responsible for."
            ),
            "eli5": "You skipped the sticky note that explains what this part of the code is for.",
            "fix": "Add a triple-quoted description on the module, class, or function the message points to.",
            "example": 'def greet(name):\n    """Return a one-line hello for ``name``."""\n    return f"Hello, {name}"',
        }

    if re.search(r"syntax", message, re.IGNORECASE):
        return ERROR_RULES["E0001"]

    return {
        "explanation": (
            "The checker or Python reported something that does not fit the rules: a name, structure, or punctuation "
            "problem. The exact message is your best clue to which rule broke."
        ),
        "eli5": "One piece of the puzzle is turned the wrong way, so the picture does not fit together.",
        "fix": "Re-read the error text and that line slowly; change one small thing, re-run, and repeat until it clears.",
        "example": "value = 42\nprint(value)",
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
        "eli5": profile["eli5"],
        "fix": profile["fix"],
        "example": profile["example"],
    }


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
