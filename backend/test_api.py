import requests
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

# =========================
# CONFIG
# =========================

BASE_URL = "http://localhost:8000"

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# =========================
# PULL LATEST ROW FROM SUPABASE
# =========================

def get_latest_row(city: str) -> dict:
    response = (
        supabase
        .table("aqi_data")
        .select("*")
        .eq("city", city.lower())
        .order("datetime", desc=True)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise ValueError(f"No data found for city: {city}")

    row = response.data[0]
    print(f"\n✅ Pulled latest row for {city}:")
    print(f"   datetime    : {row['datetime']}")
    print(f"   AQI         : {row['AQI']}")
    print(f"   pm2_5       : {row['pm2_5_ugm3']}")
    print(f"   pm10        : {row['pm10_ugm3']}")
    return row

# =========================
# HELPERS
# =========================

def print_result(endpoint: str, result: dict):
    print(f"\n{'='*50}")
    print(f"  {endpoint}")
    print(f"{'='*50}")
    for k, v in result.items():
        print(f"  {k}: {v}")

def build_payload(row: dict) -> dict:
    return {
        "city": row["city"],
        "pm2_5": row["pm2_5_ugm3"],
        "pm10": row["pm10_ugm3"],
        "co": row["co_ugm3"],
        "so2": row["so2_ugm3"],  # ← add this
        "o3": row["o3_ugm3"],
        "no2": row["no2_ugm3"],
        "hour": row["hour"],
        "month": row["month"],
        "day_of_week": row["day_of_week"],
        "is_weekend": row["is_weekend"],
    }

# =========================
# TESTS
# =========================

def test_health():
    print("\n--- Testing /health ---")
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"❌ Health check failed: {r.text}"
    print(f"✅ {r.json()}")

def test_cities():
    print("\n--- Testing /cities ---")
    r = requests.get(f"{BASE_URL}/cities")
    assert r.status_code == 200, f"❌ Cities failed: {r.text}"
    cities = r.json()["cities"]
    print(f"✅ {len(cities)} cities returned: {cities[:5]}...")

def test_forecast(payload: dict):
    print("\n--- Testing /predict/forecast ---")
    r = requests.post(f"{BASE_URL}/predict/forecast", json=payload)
    assert r.status_code == 200, f"❌ Forecast failed: {r.text}"
    result = r.json()
    print_result("/predict/forecast", {
        "city": result["city"],
        "6h":  result["forecast"]["6h"],
        "12h": result["forecast"]["12h"],
        "24h": result["forecast"]["24h"],
    })

def test_classify(payload: dict):
    print("\n--- Testing /predict/classify ---")
    r = requests.post(f"{BASE_URL}/predict/classify", json=payload)
    assert r.status_code == 200, f"❌ Classify failed: {r.text}"
    result = r.json()
    print_result("/predict/classify", result)

def test_invalid_city():
    print("\n--- Testing invalid city ---")
    r = requests.post(f"{BASE_URL}/predict/forecast", json={
        "city": "invalidcityxyz",
        "pm2_5": 50, "pm10": 80, "co": 500,
        "so2": 15,  # ← add this
        "o3": 40, "no2": 30,
        "hour": 12, "month": 4,
        "day_of_week": 0, "is_weekend": 0
    })
    assert r.status_code == 400, f"❌ Expected 400, got {r.status_code}"
    print(f"✅ Correctly rejected invalid city with 400")

def test_multiple_cities(cities: list):
    print("\n--- Testing multiple cities ---")
    for city in cities:
        try:
            row = get_latest_row(city)
            payload = build_payload(row)
            r = requests.post(f"{BASE_URL}/predict/forecast", json=payload)
            assert r.status_code == 200
            result = r.json()
            print(f"✅ {city:<20} | 6h: {result['forecast']['6h']['aqi']:.1f} ({result['forecast']['6h']['category']}) | 12h: {result['forecast']['12h']['aqi']:.1f} | 24h: {result['forecast']['24h']['aqi']:.1f}")
        except Exception as e:
            print(f"❌ {city}: {e}")

# =========================
# MAIN
# =========================

if __name__ == "__main__":
    TEST_CITY = "delhi"

    print("\n🚀 Starting API Tests...\n")

    # Basic checks
    test_health()
    test_cities()

    # Pull real data from Supabase
    row = get_latest_row(TEST_CITY)
    payload = build_payload(row)

    # Model tests
    test_forecast(payload)
    test_classify(payload)

    # Edge case
    test_invalid_city()

    # Batch test across cities
    test_multiple_cities([
        "delhi", "mumbai", "bengaluru",
        "chennai", "kolkata", "hyderabad",
        "chandigarh", "jaipur", "lucknow"
    ])

    print("\n✅ All tests complete.")