import requests
import json

res = requests.post("http://localhost:8000/search", json={
    "lat": 19.0596,
    "lng": 72.8295,
    "radius_km": 5,
    "category": "eating",
    "max_results": 10,
    "min_rating": 4.0
}, stream=True)

final_text = ""
for line in res.iter_lines():
    if line:
        decoded = line.decode('utf-8')
        if decoded.startswith('data: '):
            try:
                data = json.loads(decoded[6:])
                if data["type"] == "token":
                    final_text += data["content"]
            except:
                pass

print("=== FINAL LLM TEXT ===")
print(final_text)
