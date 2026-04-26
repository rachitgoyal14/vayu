from fastapi import HTTPException


def aqi_to_category(aqi: float):
    if aqi <= 50:
        return "Good", "#00E400"
    if aqi <= 100:
        return "Satisfactory", "#92D050"
    if aqi <= 200:
        return "Moderate", "#FFFF00"
    if aqi <= 300:
        return "Poor", "#FF7E00"
    if aqi <= 400:
        return "Very Poor", "#FF0000"
    return "Severe", "#99004C"


def encode_city(city: str, encoder):
    try:
        return int(encoder.transform([city.lower().strip()])[0])
    except Exception:
        raise HTTPException(400, f"Unknown city: {city}")