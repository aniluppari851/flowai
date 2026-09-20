import urllib.request
import json

url = "https://router.project-osrm.org/route/v1/driving/78.4483,17.4375;78.3489,17.4401?overview=full&geometries=geojson&alternatives=true&steps=true"
req = urllib.request.Request(url, headers={"User-Agent": "FlowSight-Maps/1.0"})
try:
    with urllib.request.urlopen(req, timeout=10) as response:
        data = json.loads(response.read().decode("utf-8"))
        print("OSRM Code:", data.get("code"))
        routes = data.get("routes", [])
        print("Found routes:", len(routes))
        for idx, r in enumerate(routes):
            dist_km = round(r["distance"] / 1000, 2)
            dur_min = round(r["duration"] / 60, 1)
            coords = r["geometry"]["coordinates"]
            print(f"Route {idx+1}: {dist_km} km, {dur_min} min, {len(coords)} real road nodes")
            print(f"First coord (lon, lat): {coords[0]}, Last coord: {coords[-1]}")
except Exception as e:
    print("Error:", e)
