"""
ACQR BPEID Retrieval System Test Suite
Validates signature lookups across all 16 curated beginner mistakes.
"""

import sys
from typing import Dict, Any
from services.retriever import find_bpeid_record

# Define test cases for all 16 errors
TEST_CASES = [
    # 1. Missing Colon
    ("ACQR-PY-0001", None, "expected ':' inside an if condition"),
    # 2. Unterminated String
    ("ACQR-PY-0002", None, "SyntaxError: EOL while scanning string literal"),
    # 3. Unclosed Parentheses
    ("ACQR-PY-0003", None, "unmatched ')' was never closed"),
    # 4. Mutable Default
    ("ACQR-PY-0004", "W0102", "Using mutable default argument []"),
    # 5. Indentation Error
    ("ACQR-PY-0005", None, "IndentationError: unexpected indent"),
    # 6. Assignment vs Equality
    ("ACQR-PY-0006", None, "if score = 100: is assignment"),
    # 7. Infinite Loops
    ("ACQR-PY-0007", None, "loop variable not updating inside while True"),
    # 8. Undefined Variable
    ("ACQR-PY-0008", None, "NameError: name 'user_input' is not defined"),
    # 9. String & Integer Concatenation
    ("ACQR-PY-0009", None, "TypeError: can only concatenate str (not 'int') to str"),
    # 10. List Index Out of Range
    ("ACQR-PY-0010", None, "IndexError: list index out of range"),
    # 11. KeyError
    ("ACQR-PY-0011", None, "KeyError: 'address' not found in config"),
    # 12. Shadows Builtin
    ("ACQR-PY-0012", "W0622", "Variable shadows built-in name 'sum'"),
    # 13. Global Scope Leak
    ("ACQR-PY-0013", None, "UnboundLocalError: local variable 'total' referenced before assignment"),
    # 14. List Append Returns None
    ("ACQR-PY-0014", None, "NoneType has no attribute append because append returns None"),
    # 15. List Index Float
    ("ACQR-PY-0015", None, "TypeError: list indices must be integers or slices, not float"),
    # 16. JS Operator
    ("ACQR-PY-0016", None, "Invalid operator '===' (JavaScript syntax)")
]

def run_tests():
    print("=" * 60)
    print("RUNNING BPEID RETRIEVAL SIGNATURE TESTS (16 CASES)")
    print("=" * 60)
    
    passed_count = 0
    failed_count = 0
    
    for expected_id, message_id, message in TEST_CASES:
        print(f"Testing match for {expected_id} | msg_id={message_id or 'None'} | msg='{message}' ... ", end="")
        record = find_bpeid_record(message_id, message)
        
        if record is None:
            print("❌ FAILED (No record returned)")
            failed_count += 1
        elif record.get("error_id") != expected_id:
            print(f"❌ FAILED (Returned wrong id: {record.get('error_id')})")
            failed_count += 1
        else:
            print("✅ PASSED")
            passed_count += 1
            
    print("=" * 60)
    print(f"TEST RESULTS: {passed_count} Passed | {failed_count} Failed")
    print("=" * 60)
    
    if failed_count > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    run_tests()
