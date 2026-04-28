import os
import time
import joblib
import numpy as np
import pandas as pd
import requests
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from utils import get_lag_features, aqi_to_category, encode_city, supabase
from logger import (
    log, log_startup, log_model_load, log_models_ready,
    log_request, log_supabase, log_waqi, log_openweather,
    log_prediction, log_classify, log_shap, log_error,
    log_health, log_history_query, make_logging_middleware,
    install_stdlib_bridge, Timer
)

# ─── Stdlib logging bridge (captures uvicorn / third-party) ──────────────────
install_stdlib_bridge()

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
    'pm2_5_ugm3', 'pm10_ugm3', 'co_ugm3', 'no2_ugm3',
    'so2_ugm3', 'o3_ugm3', 'month', 'hour'
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
    log_startup()

    model_specs = [
        ('xgb_6h',       'xgb_6h.pkl'),
        ('xgb_12h',      'xgb_12h.pkl'),
        ('xgb_24h',      'xgb_24h.pkl'),
        ('classifier',   'xgb_classifier.pkl'),
        ('explainer_6h', 'shap_explainer_6h.pkl'),
        ('city_encoder', 'city_encoder.pkl'),
    ]

    for key, filename in model_specs:
        path = os.path.join(MODELS_DIR, filename)
        with Timer() as t:
            models[key] = joblib.load(path)
        log_model_load(key, path, elapsed_ms=t.ms)

    log_models_ready([k for k, _ in model_specs])
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
# REQUEST LOGGING MIDDLEWARE
# =========================

app.add_middleware(BaseHTTPMiddleware, dispatch=make_logging_middleware())

# =========================
# ROUTES
# =========================

@app.get("/health")
async def health():
    log_health()  # your existing log function
    
    html_content = """
    <!DOCTYPE html>
    <html>
        <head>
            <title>VAYU Backend</title>
            <style>
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    background: linear-gradient(135deg, #1e3a8a, #3b82f6);
                    color: white;
                    height: 100vh;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                }
                .container {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    padding: 3rem 4rem;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                h1 {
                    font-size: 3.5rem;
                    margin-bottom: 1rem;
                    font-weight: 700;
                }
                p {
                    font-size: 1.4rem;
                    opacity: 0.95;
                    margin-bottom: 2rem;
                }
                .status {
                    display: inline-block;
                    background: #22c55e;
                    color: #052e16;
                    padding: 8px 20px;
                    border-radius: 50px;
                    font-weight: 600;
                    font-size: 1.1rem;
                    margin-bottom: 1.5rem;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="status">● RUNNING</div>
                <h1>VAYU Backend</h1>
                <p><strong>Healthy &amp; Ready</strong></p>
                <p>Please return to the frontend</p>
            </div>
        </body>
    </html>
    """
    return HTMLResponse(content=html_content)


@app.get("/cities")
def cities():
    city_list = list(models['city_encoder'].classes_)
    log("Cities list requested", level="INFO", count=len(city_list))
    return {"cities": city_list}


@app.get("/history/24h/all")
def history_24h_all():
    city_ids = list(models['city_encoder'].classes_)
    since = (datetime.utcnow() - timedelta(hours=48)).strftime("%Y-%m-%dT%H:00:00")

    with Timer() as t:
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
    log_history_query(
        city_count=len(city_ids),
        since=since,
        total_rows=len(rows),
        elapsed_ms=t.ms,
    )

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
    log("Forecast request received", level="INFO", city=data.get("city"))

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

    with Timer() as t:
        pred6  = float(models['xgb_6h'].predict(df)[0])
        pred12 = float(models['xgb_12h'].predict(df)[0])
        pred24 = float(models['xgb_24h'].predict(df)[0])

    def pack(val):
        cat, col = aqi_to_category(val)
        return {"aqi": val, "category": cat, "color": col}

    cat6,  _ = aqi_to_category(pred6)
    cat12, _ = aqi_to_category(pred12)
    cat24, _ = aqi_to_category(pred24)

    log_prediction(city, "6h",  input_aqi=lag1, predicted_aqi=pred6,  category=cat6,  lag1=lag1, elapsed_ms=t.ms)
    log_prediction(city, "12h", input_aqi=lag1, predicted_aqi=pred12, category=cat12, lag1=lag1)
    log_prediction(city, "24h", input_aqi=lag1, predicted_aqi=pred24, category=cat24, lag1=lag1)

    return {
        "city": city,
        "forecast": {
            "6h":  pack(pred6),
            "12h": pack(pred12),
            "24h": pack(pred24),
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
    with Timer() as t:
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
        log_supabase("SELECT", "aqi_data", city=city, rows=0, elapsed_ms=t.ms)
        raise HTTPException(status_code=404, detail=f"No latest data found for city: {city}")

    log_supabase("SELECT", "aqi_data", city=city, rows=len(response.data), elapsed_ms=t.ms)
    return response.data[0]


def _fetch_waqi(city: str):
    if not WAQI_API_KEY:
        raise HTTPException(status_code=500, detail="WAQI_API_KEY missing")

    city_lower = city.lower().strip()
    coords = CITY_COORDS.get(city_lower)
    if not coords:
        raise HTTPException(status_code=400, detail=f"Unknown city: {city}")

    t0 = time.perf_counter()

    # Step 1: search endpoint for multiple stations → median AQI
    search_url = f"https://api.waqi.info/search/?token={WAQI_API_KEY}&keyword={city_lower}"
    try:
        search_resp = requests.get(search_url, timeout=10)
    except Exception as e:
        log_waqi(city, stations_found=0, aqi_values=[], final_aqi=None,
                 elapsed_ms=(time.perf_counter() - t0) * 1000, error=e)
        raise HTTPException(status_code=502, detail=f"WAQI search failed: {str(e)}")

    if search_resp.status_code != 200:
        raise HTTPException(status_code=502, detail=search_resp.text)

    search_data = search_resp.json()
    aqi_values = []

    if search_data.get("status") == "ok":
        for station in search_data.get("data", []):
            aqi = safe_float(station.get("aqi"))
            if aqi is not None and 0 < aqi <= 500:
                aqi_values.append(aqi)

    # Step 2: geo endpoint for pollutant sub-indices
    lat, lon = coords
    geo_url = f"https://api.waqi.info/feed/geo:{lat};{lon}/?token={WAQI_API_KEY}"
    try:
        geo_resp = requests.get(geo_url, timeout=10)
    except Exception as e:
        log_waqi(city, stations_found=len(aqi_values), aqi_values=aqi_values,
                 final_aqi=None, elapsed_ms=(time.perf_counter() - t0) * 1000, error=e)
        raise HTTPException(status_code=502, detail=f"WAQI geo failed: {str(e)}")

    if geo_resp.status_code != 200:
        raise HTTPException(status_code=502, detail=geo_resp.text)

    geo_data = geo_resp.json()
    if geo_data.get("status") != "ok":
        raise HTTPException(status_code=502, detail=f"WAQI geo error: {geo_data}")

    # If search gave us AQIs use median, else fall back to geo AQI
    if aqi_values:
        from statistics import median
        final_aqi = int(median(aqi_values))
    else:
        geo_aqi = safe_float(geo_data["data"].get("aqi"))
        if geo_aqi is None or geo_aqi <= 0:
            log_waqi(city, stations_found=0, aqi_values=[], final_aqi=None,
                     elapsed_ms=(time.perf_counter() - t0) * 1000)
            return {"aqi": None, "pm2_5": 0.0, "pm10": 0.0, "co": 0.0, "no2": 0.0, "so2": 0.0, "o3": 0.0}
        final_aqi = int(geo_aqi)

    log_waqi(city, stations_found=len(aqi_values), aqi_values=aqi_values,
             final_aqi=final_aqi, elapsed_ms=(time.perf_counter() - t0) * 1000)

    iaqi = geo_data["data"].get("iaqi", {})

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

    pm2_5   = reverse_sub_index(get_iaqi("pm25"), "pm2_5") or 45.0
    pm10    = reverse_sub_index(get_iaqi("pm10"), "pm10")  or 75.0
    no2     = reverse_sub_index(get_iaqi("no2"),  "no2")   or 40.0
    so2     = reverse_sub_index(get_iaqi("so2"),  "so2")   or 20.0
    o3      = reverse_sub_index(get_iaqi("o3"),   "o3")    or 30.0
    co_mgm3 = reverse_sub_index(get_iaqi("co"),   "co")    or 0.5
    co_ugm3 = co_mgm3 * 1000

    return {
        "aqi":   final_aqi,
        "pm2_5": pm2_5,
        "pm10":  pm10,
        "co":    co_ugm3,
        "no2":   no2,
        "so2":   so2,
        "o3":    o3,
    }


@app.post("/predict/forecast/live")
def forecast_live(data: dict):
    city = data.get("city", "").lower().strip()
    if not city:
        raise HTTPException(status_code=400, detail="Field 'city' is required")

    log("Forecast live request", level="INFO", city=city)
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

        log("Forecast realtime request", level="INFO", city=city)

        log("Fetching latest row from Supabase", level="DEBUG", city=city)
        latest = _get_latest_city_row(city)

        log("Fetching WAQI AQI display value", level="DEBUG", city=city)
        try:
            waqi = _fetch_waqi(city)
        except Exception as e:
            log_error("WAQI fetch failed — using null fallback", exc=e, city=city, show_trace=False)
            waqi = {"aqi": None}

        now = datetime.now()
        current_hour        = now.hour
        current_month       = now.month
        current_day_of_week = now.weekday()
        current_is_weekend  = 1 if now.weekday() in [5, 6] else 0

        # Use Supabase pollutant readings for the model — these come from the
        # cron job which stores real CPCB-scale concentrations. WAQI's
        # reverse-mapped values are systematically lower and cause the model
        # to predict unrealistically optimistic forecasts.
        pm2_5 = float(latest.get("pm2_5_ugm3") or 0.0)
        pm10  = float(latest.get("pm10_ugm3")  or 0.0)
        co    = float(latest.get("co_ugm3")    or 0.0)
        no2   = float(latest.get("no2_ugm3")   or 0.0)
        so2   = float(latest.get("so2_ugm3")   or 0.0)
        o3    = float(latest.get("o3_ugm3")    or 0.0)

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

        log("Supabase payload ready — running forecast", level="DEBUG", city=city,
            pm2_5=pm2_5, pm10=pm10, co=co, no2=no2, so2=so2, o3=o3)

        forecast_result = forecast(payload)

        # current_aqi: prefer WAQI median (multi-station, authoritative display
        # value), fall back to Supabase stored AQI, then lag feature.
        current_aqi = waqi.get("aqi")
        if current_aqi is None:
            current_aqi = latest.get("AQI")
        if current_aqi is None:
            try:
                lag1, _, _ = get_lag_features(city)
                current_aqi = int(lag1)
            except:
                current_aqi = 100

        log("Forecast realtime complete", level="SUCCESS", city=city, current_aqi=current_aqi)

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
        log_error("forecast_realtime failed", exc=e,
                  route="/predict/forecast/realtime", city=data.get("city"))
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# =========================
# CLASSIFIER
# =========================

@app.post("/predict/classify")
def classify(data: dict):
    log("Classify request received", level="INFO", city=data.get("city"))

    city = data["city"]
    city_enc = encode_city(city, models['city_encoder'])

    df = pd.DataFrame([{
        "pm2_5_ugm3": data["pm2_5"],
        "pm10_ugm3": data["pm10"],
        "co_ugm3": data["co"],
        "no2_ugm3": data["no2"],
        "so2_ugm3": data.get("so2", 20.0),
        "o3_ugm3": data["o3"],
        "month": data.get("month", 4),
        "hour": data.get("hour", 12),
        "city_enc": city_enc
    }])[CLF_FEATURES]

    with Timer() as t:
        pred = models['classifier'].predict(df)[0]

    predicted_class = int(pred)
    cat, _ = aqi_to_category(predicted_class * 100)   # best-effort category label
    log_classify(city, predicted_class=predicted_class, predicted_category=cat, elapsed_ms=t.ms)

    return {
        "city": city,
        "predicted_class": predicted_class,
    }


@app.post("/predict/explain/forecast")
def explain_forecast(data: dict):
    city = data.get("city", "unknown")
    log("SHAP explain request received", level="INFO", city=city)

    df = _build_forecast_dataframe(data)
    explainer = models.get("explainer_6h")

    if explainer is None:
        log_error("SHAP explainer not loaded", route="/predict/explain/forecast", city=city)
        raise HTTPException(status_code=500, detail="SHAP explainer not loaded")

    try:
        with Timer() as t:
            shap_values_array = explainer.shap_values(df)

        if isinstance(shap_values_array, list):
            shap_values_row = np.array(shap_values_array[0])[0]
        else:
            shap_values_row = np.array(shap_values_array)[0]

        feature_names = list(df.columns)
        shap_values = {
            feature_names[i]: float(shap_values_row[i])
            for i in range(len(feature_names))
        }

        # Log top contributing feature
        top_feature = max(shap_values, key=lambda k: abs(shap_values[k]))
        log_shap(city, top_feature=top_feature, top_value=shap_values[top_feature],
                 elapsed_ms=t.ms)

        return {"shap_values": shap_values}

    except Exception as e:
        log_shap(city, error=e)
        # Return empty dict instead of crashing the whole endpoint
        return {"shap_values": {}}