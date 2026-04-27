import os
import joblib
import numpy as np
import pandas as pd
import requests
from datetime import datetime, timedelta

from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException

from utils import get_lag_features, aqi_to_category, encode_city, supabase

# =========================
# SAFE UTILITIES
# =========================

def safe_float(val):
    try:
        if val in [None, "-", "", "NA"]:
            return None
        return float(val)
    except:
        return None

# =========================
# PATH SETUP
# =========================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.abspath(os.path.join(BASE_DIR, "../models"))
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
WAQI_API_KEY = os.getenv("WAQI_API_KEY")

# =========================
# FEATURES
# =========================

FORECAST_FEATURES = [
    'pm2_5_ugm3',
    'pm10_ugm3',
    'co_ugm3',
    'no2_ugm3',
    'so2_ugm3',
    'o3_ugm3',
    'hour',
    'day_of_week',
    'month',
    'is_weekend',
    'city_enc',
    'AQI_lag_1',
    'AQI_lag_6',
    'AQI_lag_24'
]

CLF_FEATURES = [
    'pm2_5_ugm3', 'pm10_ugm3', 'co_ugm3',
    'o3_ugm3', 'no2_ugm3', 'city_enc'
]

LOG_COLS = ['pm2_5_ugm3', 'pm10_ugm3', 'co_ugm3', 'o3_ugm3', 'no2_ugm3']

CPCB_BREAKPOINTS = {
    "pm2_5": [(0, 30, 0, 50), (31, 60, 51, 100), (61, 90, 101, 200), (91, 120, 201, 300), (121, 250, 301, 400), (251, 500, 401, 500)],
    "pm10": [(0, 50, 0, 50), (51, 100, 51, 100), (101, 250, 101, 200), (251, 350, 201, 300), (351, 430, 301, 400), (431, 600, 401, 500)],
    "no2": [(0, 40, 0, 50), (41, 80, 51, 100), (81, 180, 101, 200), (181, 280, 201, 300), (281, 400, 301, 400), (401, 1000, 401, 500)],
    "so2": [(0, 40, 0, 50), (41, 80, 51, 100), (81, 380, 101, 200), (381, 800, 201, 300), (801, 1600, 301, 400), (1601, 2000, 401, 500)],
    "o3": [(0, 50, 0, 50), (51, 100, 51, 100), (101, 168, 101, 200), (169, 208, 201, 300), (209, 748, 301, 400), (749, 1000, 401, 500)],
    "co": [(0, 1, 0, 50), (1.1, 2, 51, 100), (2.1, 10, 101, 200), (10.1, 17, 201, 300), (17.1, 34, 301, 400), (34.1, 50, 401, 500)],
}

models = {}

CITY_COORDS = {
    "agartala": (23.8315, 91.2868),
    "ahmedabad": (23.0225, 72.5714),
    "aizawl": (23.7307, 92.7173),
    "bengaluru": (12.9716, 77.5946),
    "bhopal": (23.2599, 77.4126),
    "bhubaneswar": (20.2961, 85.8245),
    "chandigarh": (30.7333, 76.7794),
    "chennai": (13.0827, 80.2707),
    "dehradun": (30.3165, 78.0322),
    "delhi": (28.6139, 77.2090),
    "gangtok": (27.3389, 88.6065),
    "gurugram": (28.4595, 77.0266),
    "guwahati": (26.1158, 91.7086),
    "hyderabad": (17.3850, 78.4867),
    "imphal": (24.8170, 93.9368),
    "itanagar": (27.0844, 93.6053),
    "jaipur": (26.9124, 75.7873),
    "kohima": (25.6751, 94.1086),
    "kolkata": (22.5726, 88.3639),
    "lucknow": (26.8467, 80.9462),
    "mumbai": (19.0760, 72.8777),
    "panaji": (15.4909, 73.8278),
    "patna": (25.5941, 85.1376),
    "raipur": (21.2514, 81.6296),
    "ranchi": (23.3441, 85.3096),
    "shillong": (25.5788, 91.8933),
    "shimla": (31.1048, 77.1734),
    "thiruvananthapuram": (8.5241, 76.9366),
    "visakhapatnam": (17.6868, 83.2185),
}

# =========================
# LOAD MODELS
# =========================

@asynccontextmanager
async def lifespan(app: FastAPI):

    models['xgb_6h'] = joblib.load(os.path.join(MODELS_DIR, 'xgb_6h.pkl'))
    models['xgb_12h'] = joblib.load(os.path.join(MODELS_DIR, 'xgb_12h.pkl'))
    models['xgb_24h'] = joblib.load(os.path.join(MODELS_DIR, 'xgb_24h.pkl'))

    models['classifier'] = joblib.load(os.path.join(MODELS_DIR, 'best_classifier.pkl'))

    models['explainer_6h'] = joblib.load(os.path.join(MODELS_DIR, 'shap_explainer_6h.pkl'))

    models['city_encoder'] = joblib.load(os.path.join(MODELS_DIR, 'city_encoder.pkl'))

    print("----------------------------------------------- MODELS LOADED ---------------------------------------------------")
    yield


app = FastAPI(lifespan=lifespan)

# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# ROUTES
# =========================

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/cities")
def cities():
    return {"cities": list(models['city_encoder'].classes_)}


@app.get("/history/24h/all")
def history_24h_all():
    city_ids = list(models['city_encoder'].classes_)
    since = (datetime.utcnow() - timedelta(hours=48)).strftime("%Y-%m-%dT%H:00:00")
    response = (
        supabase
        .table("aqi_data")
        .select("city,datetime,pm2_5_ugm3,pm10_ugm3,co_ugm3,no2_ugm3,so2_ugm3,o3_ugm3,AQI")
        .in_("city", city_ids)
        .gte("datetime", since)
        .order("datetime", desc=False)
        .execute()
    )

    rows = response.data or []
    by_city = {city: [] for city in city_ids}
    for row in rows:
        city = row.get("city")
        if city in by_city:
            by_city[city].append(row)

    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    slots = [now - timedelta(hours=(23 - i)) for i in range(24)]

    def sub_index(value: float, pollutant: str):
        for c_low, c_high, i_low, i_high in CPCB_BREAKPOINTS[pollutant]:
            if c_low <= value <= c_high:
                return ((i_high - i_low) / (c_high - c_low)) * (value - c_low) + i_low
        return 500.0

    def compute_cpcb_aqi(row: dict):
        pm2_5 = float(row.get("pm2_5_ugm3") or 0)
        pm10 = float(row.get("pm10_ugm3") or 0)
        co = float(row.get("co_ugm3") or 0) / 1000.0
        no2 = float(row.get("no2_ugm3") or 0)
        so2 = float(row.get("so2_ugm3") or 0)
        o3 = float(row.get("o3_ugm3") or 0)
        return round(max([
            sub_index(pm2_5, "pm2_5"),
            sub_index(pm10, "pm10"),
            sub_index(co, "co"),
            sub_index(no2, "no2"),
            sub_index(so2, "so2"),
            sub_index(o3, "o3"),
        ]))

    result = {}
    for city in city_ids:
        city_rows = by_city.get(city, [])
        known = []
        for row in city_rows:
            try:
                dt = pd.to_datetime(row.get("datetime")).to_pydatetime().replace(minute=0, second=0, microsecond=0)
            except Exception:
                continue
            if row.get("AQI") is not None:
                value = float(row.get("AQI"))
            else:
                value = float(compute_cpcb_aqi(row))
            known.append((dt, value))
        known.sort(key=lambda x: x[0])

        series = []
        for slot in slots:
            exact = next((v for t, v in known if t == slot), None)
            if exact is not None:
                val = exact
            else:
                left = next(((t, v) for t, v in reversed(known) if t < slot), None)
                right = next(((t, v) for t, v in known if t > slot), None)
                if left and right:
                    span = max(1.0, (right[0] - left[0]).total_seconds())
                    pos = (slot - left[0]).total_seconds()
                    val = left[1] + (right[1] - left[1]) * (pos / span)
                elif left:
                    # mean reversion drift for missing future points
                    val = max(0.0, left[1] * 0.995)
                elif right:
                    val = max(0.0, right[1] * 1.005)
                else:
                    val = 80.0
            series.append({
                "datetime": slot.isoformat(),
                "time": slot.strftime("%H:00"),
                "value": round(float(val), 2),
            })
        result[city] = series

    return {"cities": result}


# =========================
# FORECAST
# =========================

@app.post("/predict/forecast")
def forecast(data: dict):
    print("Incoming:", data)

    city = data["city"]
    city_enc = encode_city(city, models['city_encoder'])

    lag1, lag6, lag24 = get_lag_features(city)

    features = {
        "pm2_5_ugm3": data["pm2_5"],
        "pm10_ugm3": data["pm10"],
        "co_ugm3": data["co"],
        "so2_ugm3": data["so2"],
        "o3_ugm3": data["o3"],
        "no2_ugm3": data["no2"],
        "city_enc": city_enc,
        "hour": data["hour"],
        "month": data["month"],
        "day_of_week": data["day_of_week"],
        "is_weekend": data["is_weekend"],
        "AQI_lag_1": lag1,
        "AQI_lag_6": lag6,
        "AQI_lag_24": lag24
    }

    df = pd.DataFrame([features])

    for col in LOG_COLS:
        df[col] = np.log1p(df[col])

    df = df[FORECAST_FEATURES]

    pred6 = float(models['xgb_6h'].predict(df)[0])
    pred12 = float(models['xgb_12h'].predict(df)[0])
    pred24 = float(models['xgb_24h'].predict(df)[0])

    def pack(val):
        cat, col = aqi_to_category(val)
        return {"aqi": val, "category": cat, "color": col}

    return {
        "city": city,
        "forecast": {
            "6h": pack(pred6),
            "12h": pack(pred12),
            "24h": pack(pred24)
        }
    }


def _build_forecast_dataframe(data: dict):
    city = data["city"]
    city_enc = encode_city(city, models['city_encoder'])
    lag1, lag6, lag24 = get_lag_features(city)

    features = {
        "pm2_5_ugm3": data["pm2_5"],
        "pm10_ugm3": data["pm10"],
        "co_ugm3": data["co"],
        "so2_ugm3": data["so2"],
        "o3_ugm3": data["o3"],
        "no2_ugm3": data["no2"],
        "city_enc": city_enc,
        "hour": data["hour"],
        "month": data["month"],
        "day_of_week": data["day_of_week"],
        "is_weekend": data["is_weekend"],
        "AQI_lag_1": lag1,
        "AQI_lag_6": lag6,
        "AQI_lag_24": lag24
    }

    df = pd.DataFrame([features])
    for col in LOG_COLS:
        df[col] = np.log1p(df[col])
    return df[FORECAST_FEATURES]


def _get_latest_city_row(city: str):
    response = (
        supabase
        .table("aqi_data")
        .select("*")
        .eq("city", city.lower().strip())
        .order("datetime", desc=True)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail=f"No latest data found for city: {city}")

    return response.data[0]


def _fetch_waqi(city: str):
    """Fetch AQI + reverse-engineered pollutant concentrations from WAQI geo endpoint."""
    if not WAQI_API_KEY:
        raise HTTPException(status_code=500, detail="WAQI_API_KEY missing")

    city_lower = city.lower().strip()
    coords = CITY_COORDS.get(city_lower)
    if not coords:
        raise HTTPException(status_code=400, detail=f"Unknown city: {city}")

    lat, lon = coords
    url = f"https://api.waqi.info/feed/geo:{lat};{lon}/?token={WAQI_API_KEY}"

    try:
        response = requests.get(url, timeout=10)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"WAQI request failed: {str(e)}")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=response.text)

    data = response.json()
    if data.get("status") != "ok":
        raise HTTPException(status_code=502, detail=f"WAQI error: {data}")

    d = data["data"]
    aqi = safe_float(d.get("aqi"))
    if aqi is None or aqi <= 0:
        return {"aqi": None, "pm2_5": 0.0, "pm10": 0.0, "co": 0.0, "no2": 0.0, "so2": 0.0, "o3": 0.0}

    iaqi = d.get("iaqi", {})

    def get_iaqi(key):
        val = iaqi.get(key, {}).get("v")
        return safe_float(val)

    def reverse_sub_index(sub_index, pollutant):
        if sub_index is None:
            return None
        for c_low, c_high, i_low, i_high in CPCB_BREAKPOINTS[pollutant]:
            if i_low <= sub_index <= i_high:
                return round(((sub_index - i_low) / (i_high - i_low)) * (c_high - c_low) + c_low, 4)
        return CPCB_BREAKPOINTS[pollutant][-1][1]

    pm25_si = get_iaqi("pm25")
    pm10_si = get_iaqi("pm10")
    no2_si  = get_iaqi("no2")
    so2_si  = get_iaqi("so2")
    o3_si   = get_iaqi("o3")
    co_si   = get_iaqi("co")

    pm2_5 = reverse_sub_index(pm25_si, "pm2_5") or 45.0
    pm10  = reverse_sub_index(pm10_si, "pm10")  or 75.0
    no2   = reverse_sub_index(no2_si,  "no2")   or 40.0
    so2   = reverse_sub_index(so2_si,  "so2")   or 20.0
    o3    = reverse_sub_index(o3_si,   "o3")    or 30.0
    co_mgm3 = reverse_sub_index(co_si, "co")    or 0.5
    co_ugm3 = co_mgm3 * 1000

    return {
        "aqi":   int(min(aqi, 500)),
        "pm2_5": pm2_5,
        "pm10":  pm10,
        "co":    co_ugm3,
        "no2":   no2,
        "so2":   so2,
        "o3":    o3,
    }

def _fetch_openweather(city: str):
    if not OPENWEATHER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENWEATHER_API_KEY missing")

    city_lower = city.lower().strip()
    coords = CITY_COORDS.get(city_lower)
    if not coords:
        raise HTTPException(status_code=400, detail=f"Unknown city: {city}")

    lat, lon = coords
    url = f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}"

    try:
        response = requests.get(url, timeout=10)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenWeather request failed: {str(e)}")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=response.text)

    data = response.json()

    if "list" not in data or len(data["list"]) == 0:
        raise HTTPException(status_code=502, detail=f"Invalid OpenWeather response: {data}")

    components = data["list"][0].get("components", {})

    pm2_5 = safe_float(components.get("pm2_5")) or 0.0
    pm10 = safe_float(components.get("pm10")) or 0.0
    co = safe_float(components.get("co")) or 0.0
    no2 = safe_float(components.get("no2")) or 0.0
    so2 = safe_float(components.get("so2")) or 0.0
    o3 = safe_float(components.get("o3")) or 0.0

    return {
        "pm2_5": pm2_5,
        "pm10": pm10,
        "co": co,
        "no2": no2,
        "so2": so2,
        "o3": o3,
    }


@app.post("/predict/forecast/live")
def forecast_live(data: dict):
    city = data.get("city", "").lower().strip()
    if not city:
        raise HTTPException(status_code=400, detail="Field 'city' is required")

    latest = _get_latest_city_row(city)

    payload = {
        "city": city,
        "pm2_5": latest["pm2_5_ugm3"],
        "pm10": latest["pm10_ugm3"],
        "co": latest["co_ugm3"],
        "no2": latest["no2_ugm3"],
        "so2": latest["so2_ugm3"],
        "o3": latest["o3_ugm3"],
        "hour": latest["hour"],
        "month": latest["month"],
        "day_of_week": latest["day_of_week"],
        "is_weekend": latest["is_weekend"],
    }

    forecast_result = forecast(payload)

    return {
        "city": city,
        "datetime": latest.get("datetime"),
        "current": {
            "AQI": latest.get("AQI"),
            "pm2_5": latest.get("pm2_5_ugm3"),
            "pm10": latest.get("pm10_ugm3"),
            "co": latest.get("co_ugm3"),
            "no2": latest.get("no2_ugm3"),
            "so2": latest.get("so2_ugm3"),
            "o3": latest.get("o3_ugm3"),
            "hour": latest.get("hour"),
            "month": latest.get("month"),
            "day_of_week": latest.get("day_of_week"),
            "is_weekend": latest.get("is_weekend"),
        },
        "forecast": forecast_result["forecast"],
    }


@app.post("/predict/forecast/realtime")
def forecast_realtime(data: dict):
    try:
        city = data.get("city", "").lower().strip()
        if not city:
            raise HTTPException(status_code=400, detail="Field 'city' is required")

        print("=== Forecast Realtime Request ===")
        print(f"City: {city}")

        print("Fetching latest row from Supabase...")
        latest = _get_latest_city_row(city)

        print("Fetching WAQI (AQI + pollutants)...")
        try:
            waqi = _fetch_waqi(city)
        except Exception as e:
            print(f"WAQI fetch error: {e}")
            waqi = {"aqi": None, "pm2_5": 0.0, "pm10": 0.0, "co": 0.0, "no2": 0.0, "so2": 0.0, "o3": 0.0}

        print(f"WAQI response: {waqi}")

        now = datetime.now()
        current_hour = now.hour
        current_month = now.month
        current_day_of_week = now.weekday()
        current_is_weekend = 1 if now.weekday() in [5, 6] else 0

        pm2_5 = waqi.get("pm2_5") or 0.0
        pm10  = waqi.get("pm10")  or 0.0
        co    = waqi.get("co")    or 0.0
        no2   = waqi.get("no2")   or 0.0
        so2   = waqi.get("so2")   or 0.0
        o3    = waqi.get("o3")    or 0.0

        payload = {
            "city":        city,
            "pm2_5":       pm2_5,
            "pm10":        pm10,
            "co":          co,
            "no2":         no2,
            "so2":         so2,
            "o3":          o3,
            "hour":        current_hour,
            "month":       current_month,
            "day_of_week": current_day_of_week,
            "is_weekend":  current_is_weekend,
        }

        print(f"Payload: {payload}")
        forecast_result = forecast(payload)
        print(f"Forecast result: {forecast_result}")

        current_aqi = waqi.get("aqi")
        if current_aqi is None:
            try:
                lag1, _, _ = get_lag_features(city)
                current_aqi = int(lag1)
            except:
                current_aqi = 100

        return {
            "city":        city,
            "datetime":    now.isoformat(),
            "current_aqi": current_aqi,
            "current": {
                "pm2_5":        pm2_5,
                "pm10":         pm10,
                "co":           co,
                "no2":          no2,
                "so2":          so2,
                "o3":           o3,
                "hour":         current_hour,
                "month":        current_month,
                "day_of_week":  current_day_of_week,
                "is_weekend":   current_is_weekend,
            },
            "forecast": forecast_result["forecast"],
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in forecast_realtime: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# =========================
# CLASSIFIER
# =========================

@app.post("/predict/classify")
def classify(data: dict):
    print("Incoming:", data)

    city = data["city"]
    city_enc = encode_city(city, models['city_encoder'])

    df = pd.DataFrame([{
        "pm2_5_ugm3": data["pm2_5"],
        "pm10_ugm3": data["pm10"],
        "co_ugm3": data["co"],
        "o3_ugm3": data["o3"],
        "no2_ugm3": data["no2"],
        "city_enc": city_enc
    }])[CLF_FEATURES]

    pred = models['classifier'].predict(df)[0]

    return {
        "city": city,
        "predicted_class": int(pred)
    }


@app.post("/predict/explain/forecast")
def explain_forecast(data: dict):
    print("Incoming:", data)

    df = _build_forecast_dataframe(data)
    explainer = models.get("explainer_6h")
    if explainer is None:
        raise HTTPException(status_code=500, detail="SHAP explainer model not loaded")

    try:
        shap_result = explainer.shap_values(df)
        if isinstance(shap_result, list):
            shap_values_row = np.array(shap_result[0])[0]
        else:
            shap_values_row = np.array(shap_result)[0]

        feature_names = list(df.columns)
        shap_values = {feature_names[i]: float(shap_values_row[i]) for i in range(len(feature_names))}
        return {"shap_values": shap_values}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SHAP explain failed: {str(e)}")