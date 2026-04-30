import asyncio
import httpx
import time

URL = "http://127.0.0.1:8000/analyze"

async def fetch_analyze(client, i):
    # We modify the function name slightly so the code is unique
    # This bypasses the newly implemented SHA256 cache to ensure we actually hit the AI API!
    code_payload = f"def test_{i}()\n    print('hello')"
    
    payload = {
        "code": code_payload
    }
    
    try:
        response = await client.post(URL, json=payload, timeout=60.0)
        data = response.json()
        
        # Analyze response to see if it's AI or fallback
        # Our deterministic fallback for syntax errors outputs: "Missing colon ':' at the end of the block header."
        errors = data.get("errors", [])
        is_fallback = False
        
        if errors:
            explanation = errors[0].get("explanation", "")
            if "Missing colon" in explanation or "Python found an issue" in explanation:
                is_fallback = True
                
        return {
            "index": i,
            "status": response.status_code,
            "is_fallback": is_fallback,
            "error": None
        }
    except Exception as e:
        return {
            "index": i,
            "status": None,
            "is_fallback": False,
            "error": str(e)
        }

async def main():
    num_requests = 15
    print(f"Starting stress test with {num_requests} concurrent requests...")
    
    start_time = time.time()
    
    async with httpx.AsyncClient() as client:
        tasks = [fetch_analyze(client, i) for i in range(num_requests)]
        results = await asyncio.gather(*tasks)
        
    end_time = time.time()
    
    success_count = 0
    fallback_count = 0
    fail_count = 0
    
    print("\n--- RESULTS ---")
    for res in results:
        if res["error"]:
            print(f"Req {res['index']:02d} | FAILED | Error: {res['error']}")
            fail_count += 1
        else:
            source = "FALLBACK" if res["is_fallback"] else "AI"
            print(f"Req {res['index']:02d} | Status: {res['status']} | Source: {source}")
            success_count += 1
            if res["is_fallback"]:
                fallback_count += 1
                
    print("\n--- SUMMARY ---")
    print(f"Total Requests: {num_requests}")
    print(f"Success Count:  {success_count}")
    print(f"Fallback Count: {fallback_count}")
    print(f"AI Hit Count:   {success_count - fallback_count}")
    print(f"Failed Connect: {fail_count}")
    print(f"Time Taken:     {end_time - start_time:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(main())
