import requests

base = "http://localhost:5000"
endpoints = [
    "/stats",
    "/latest-meals",
    "/random-meals",
    "/ingredients",
    "/search?q=chicken",
    "/meals-by-category?category=Chicken",
    "/meals-by-ingredient?ingredient=garlic",
    "/recipe/1",
]

for ep in endpoints:
    try:
        r = requests.get(base + ep, timeout=8)
        if r.status_code == 200:
            data = r.json()
            keys = list(data.keys())
            print(f"[{r.status_code}] {ep} -> keys: {keys}")
        else:
            print(f"[{r.status_code}] {ep} -> {r.text}")
    except Exception as e:
        print(f"[ERR] {ep} -> {e}")
