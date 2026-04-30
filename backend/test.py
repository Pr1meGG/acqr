import time
from google import genai

client = genai.Client(api_key="AIzaSyAjfCe9QJMSKJZ3PcVMAHasAu3_I2VGT58")

for i in range(3):
    try:
        response = client.models.generate_content(
            model="models/gemini-2.0-flash-lite",
            contents="Say hello"
        )
        print("SUCCESS:", response.text)
        break
    except Exception as e:
        print("Retrying...", e)
        time.sleep(2)