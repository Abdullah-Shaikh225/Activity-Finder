import requests

res = requests.post("http://localhost:8000/search", json={
    "lat": 19.0596,
    "lng": 72.8295,
    "radius_km": 5,
    "category": "eating",
    "max_results": 10,
    "min_rating": 4.0
}, stream=True)

for line in res.iter_lines():
    if line:
        print(line.decode('utf-8'))
