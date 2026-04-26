import json
import joblib
import numpy as np
import pandas as pd
import requests
import os

from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

# =========================
# CONSTANTS
# =========================

CSV_URL = "https://raw.githubusercontent.com/rachitgoyal14/vayu/data/forecaster/hourlyData.csv"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODELS_DIR = os.path.abspath(os.path.join(BASE_DIR, "../models"))

FORECAST_FEATURES = [
    'pm2_5_ugm3',
    'pm10_ugm3',
    'co_ugm3',
    'o3_ugm3',
    'no2_ugm3',
    'city_enc',
    'hour',
    'month',
    'day_of_week',
    'is_weekend',
    'AQI_lag_1',
    'AQI_lag_6',
    'AQI_lag_24'
]

CLF_FEATURES = [
    'pm2_5_ugm3',
    'pm10_ugm3',
    'co_ugm3',
    'o3_ugm3',
    'no2_ugm3',
    'city_enc'
]

LOG_COLS = ['pm2_5_ugm3', 'pm10_ugm3', 'co_ugm3', 'o3_ugm3', 'no2_ugm3']

INT_TO_CAT = {
    0: 'Good',
    2: 'Moderate',
    3: 'Poor',
    4: 'Very Poor'
}

CAT_COLORS = {
    'Good': '#00E400',
    'Moderate': '#FFFF00',
    'Poor': '#FF7E00',
    'Very Poor': '#FF0000'
}

label_map_from_xgb = {0: 0, 1: 2, 2: 3, 3: 4}

# =========================
# GLOBAL MODELS STORE
# =========================

models = {}

# =========================
# LIFESPAN (LOAD MODELS ONCE)
# =========================

@asynccontextmanager
async def lifespan(app: FastAPI):
    models['xgb_6h'] = joblib.load(os.path.join(MODELS_DIR, 'xgb_6h.pkl'))
    models['xgb_12h'] = joblib.load(os.path.join(MODELS_DIR, 'xgb_12h.pkl'))
    models['xgb_24h'] = joblib.load(os.path.join(MODELS_DIR, 'xgb_24h.pkl'))

    models['classifier'] = joblib.load(os.path.join(MODELS_DIR, 'best_classifier.pkl'))
    models['explainer'] = joblib.load(os.path.join(MODELS_DIR, 'shap_explainer.pkl'))
    models['city_encoder'] = joblib.load(os.path.join(MODELS_DIR, 'city_encoder.pkl'))

    print("✅ Models loaded")

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
# UTIL: AQI CATEGORY
# =========================

def aqi_to_category(aqi: float):
    if aqi <= 50: return 'Good', '#00E400'
    if aqi <= 100: return 'Satisfactory', '#92D050'
    if aqi <= 200: return 'Moderate', '#FFFF00'
    if aqi <= 300: return 'Poor', '#FF7E00'
    if aqi <= 400: return 'Very Poor', '#FF0000'
    return 'Severe', '#99004C'

# =========================
# UTIL: CITY ENCODING
# =========================

def encode_city(city: str):
    try:
        return int(models['city_encoder'].transform([city.lower().strip()])[0])
    except:
        raise HTTPException(400, f"Unknown city: {city}")

# =========================
# UTIL: FETCH LAG FEATURES
# =========================

def get_lag_features(city: str):
    try:
        df = pd.read_csv(CSV_URL)
        df['datetime'] = pd.to_datetime(df['datetime'])

        city_df = df[df['city'] == city.lower()].sort_values('datetime')
        city_df = city_df.ffill()

        if len(city_df) == 0:
            raise ValueError

        lag_1 = city_df['AQI'].iloc[-1]
        lag_6 = city_df['AQI'].iloc[-6] if len(city_df) >= 6 else lag_1
        lag_24 = city_df['AQI'].iloc[-24] if len(city_df) >= 24 else lag_1

        return lag_1, lag_6, lag_24

    except:
        raise HTTPException(500, "Failed to fetch lag data")

# =========================
# HEALTH
# =========================

@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": True}

# =========================
# CITIES
# =========================

@app.get("/cities")
def get_cities():
    return {"cities": list(models['city_encoder'].classes_)}

# =========================
# FORECAST
# =========================

@app.post("/predict/forecast")
def forecast(data: dict):

    city = data["city"]
    city_enc = encode_city(city)

    lag1, lag6, lag24 = get_lag_features(city)

    features = {
        "pm2_5_ugm3": data["pm2_5"],
        "pm10_ugm3": data["pm10"],
        "co_ugm3": data["co"],
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

    # LOG TRANSFORM
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

# =========================
# CLASSIFIER
# =========================

@app.post("/predict/classify")
def classify(data: dict):

    city = data["city"]
    city_enc = encode_city(city)

    features = {
        "pm2_5_ugm3": data["pm2_5"],
        "pm10_ugm3": data["pm10"],
        "co_ugm3": data["co"],
        "o3_ugm3": data["o3"],
        "no2_ugm3": data["no2"],
        "city_enc": city_enc
    }

    df = pd.DataFrame([features])[CLF_FEATURES]

    pred_internal = models['classifier'].predict(df)[0]
    pred_mapped = label_map_from_xgb[pred_internal]

    category = INT_TO_CAT[pred_mapped]
    color = CAT_COLORS[category]

    probs = models['classifier'].predict_proba(df)[0]

    return {
        "city": city,
        "predicted_category": category,
        "color": color,
        "probabilities": {
            "Good": float(probs[0]),
            "Moderate": float(probs[1]),
            "Poor": float(probs[2]),
            "Very Poor": float(probs[3]),
        }
    }

# =========================
# EXPLAIN
# =========================

@app.post("/predict/explain")
def explain(data: dict):

    city = data["city"]
    city_enc = encode_city(city)

    features = {
        "pm2_5_ugm3": data["pm2_5"],
        "pm10_ugm3": data["pm10"],
        "co_ugm3": data["co"],
        "o3_ugm3": data["o3"],
        "no2_ugm3": data["no2"],
        "city_enc": city_enc
    }

    df = pd.DataFrame([features])[CLF_FEATURES]

    pred_internal = models['classifier'].predict(df)[0]
    shap_vals = models['explainer'].shap_values(df)

    shap_for_class = shap_vals[0, :, pred_internal]

    return {
        "shap_values": dict(zip(CLF_FEATURES, shap_for_class.tolist()))
    }