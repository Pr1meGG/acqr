import asyncio
import httpx
import json

URL = "http://localhost:8000/analyze"

tests = [
    # 🔴 SYNTAX ERRORS
    {
        "name": "missing_colon",
        "code": "def test(a,b)\n    return a+b",
        "expected_types": ["syntax"]
    },
    {
        "name": "bad_indent",
        "code": "def test():\nprint('hi')",
        "expected_types": ["syntax"]
    },
    # 🟠 STATIC / LINT
    {
        "name": "unused_variable",
        "code": "x = 10",
        "expected_types": ["lint"]
    },
    # 🔵 RUNTIME (HEURISTIC)
    {
        "name": "division_by_zero",
        "code": "def div(a,b):\n    return a/0",
        "expected_types": ["runtime"]
    },
    {
        "name": "infinite_loop",
        "code": "while True:\n    pass",
        "expected_types": ["runtime"]
    },
    # 🟣 LOGICAL (AI)
    {
        "name": "wrong_square",
        "code": "def square(x):\n    return x + x",
        "expected_types": ["logical"]
    },
    {
        "name": "unsafe_division",
        "code": "def safe_div(a,b):\n    return a/b",
        "expected_types": ["runtime", "logical"]
    },
    # 🟡 NAME ERRORS
    {
        "name": "undefined_variable",
        "code": "def greet(name):\n    print(username)",
        "expected_types": ["runtime", "lint"]
    },
    # 🟢 ADVANCED BEGINNER MISTAKES
    {
        "name": "mutable_default",
        "code": "def add_item(x, lst=[]):\n    lst.append(x)\n    return lst",
        "expected_types": ["logical"]
    },
    {
        "name": "shadow_builtin",
        "code": "list = [1,2,3]",
        "expected_types": ["lint"]
    },
    {
        "name": "missing_return",
        "code": "def add(a,b):\n    c = a+b",
        "expected_types": ["logical"]
    }
]

async def run_tests():
    passed = 0
    failed = 0
    
    print("=" * 50)
    print("🚀 STARTING ACQR TEST SUITE")
    print("=" * 50 + "\n")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        for t in tests:
            print(f"[{t['name'].upper()}]")
            print(f"Code:\n{t['code']}")
            
            payload = {"code": t["code"]}
            try:
                resp = await client.post(URL, json=payload)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                print(f"\n❌ Error communicating with backend: {e}")
                failed += 1
                print("-" * 50 + "\n")
                continue
                
            errors = data.get("errors", [])
            
            detected_types = []
            detected_sources = set()
            has_fix = False
            confidences = []
            
            for err in errors:
                if err.get("type"):
                    detected_types.append(err.get("type"))
                for src in err.get("source", []):
                    detected_sources.add(src)
                if err.get("fix"):
                    has_fix = True
                if err.get("confidence") is not None:
                    confidences.append(err.get("confidence"))
            
            detected_types = list(set([t for t in detected_types if t]))
            detected_sources = list(detected_sources)
            
            print(f"\nDetected Issues: {len(errors)}")
            print(f"Types: {detected_types}")
            print(f"Sources: {detected_sources}")
            print(f"Has Fix: {'Yes' if has_fix else 'No'}")
            if confidences:
                print(f"Confidences: {confidences}")
                
            # Check pass condition
            is_pass = False
            for exp in t["expected_types"]:
                # Match partially or fully
                if any(exp.lower() in (dt.lower() if dt else "") for dt in detected_types):
                    is_pass = True
                    break
                    
            if is_pass:
                print("\n✅ PASS")
                passed += 1
            else:
                print(f"\n❌ FAIL (Expected one of {t['expected_types']})")
                failed += 1
                
            print("-" * 50 + "\n")
            
    total = len(tests)
    print("=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    print(f"Total Tests: {total}")
    print(f"Passed:      {passed}")
    print(f"Failed:      {failed}")
    if total > 0:
        print(f"Accuracy:    {(passed/total)*100:.1f}%")

if __name__ == "__main__":
    asyncio.run(run_tests())
