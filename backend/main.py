import os
import joblib
import numpy as np
import pandas as pd

from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from utils import get_lag_features, aqi_to_category, encode_city

# =========================
# PATH SETUP
# =========================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.abspath(os.path.join(BASE_DIR, "../models"))

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

models = {}

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


# =========================
# FORECAST
# =========================

@app.post("/predict/forecast")
def forecast(data: dict):

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


# =========================
# CLASSIFIER
# =========================

@app.post("/predict/classify")
def classify(data: dict):

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