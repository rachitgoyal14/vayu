import joblib
import pandas as pd
from forecaster.generate_features_from_csv import generate_features

# -----------------------
# Load models + encoder
# -----------------------
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

model_6 = joblib.load(os.path.join(BASE_DIR, "models/xgb_6h.pkl"))
model_12 = joblib.load(os.path.join(BASE_DIR, "models/xgb_12h.pkl"))
model_24 = joblib.load(os.path.join(BASE_DIR, "models/xgb_24h.pkl"))

city_encoder = joblib.load(os.path.join(BASE_DIR, "models/city_encoder.pkl"))

# -----------------------
# Feature order (MUST match training)
# -----------------------
FEATURE_COLUMNS = [
    "pm2_5_ugm3",
    "pm10_ugm3",
    "co_ugm3",
    "no2_ugm3",
    "so2_ugm3",
    "o3_ugm3",
    "hour",
    "day_of_week",
    "month",
    "is_weekend",
    "city_enc",
    "AQI_lag_1",
    "AQI_lag_6",
    "AQI_lag_24"
]

# -----------------------
# Prediction function
# -----------------------
def predict_aqi(city):
    city = city.lower()

    # Generate features
    features = generate_features(city)

    # Encode city
    city_encoded = city_encoder.transform([city])[0]
    features["city_enc"] = city_encoded

    # Convert to DataFrame
    X = pd.DataFrame([features])

    # Ensure correct column order
    X = X[FEATURE_COLUMNS]

    # Predictions
    pred_6 = model_6.predict(X)[0]
    pred_12 = model_12.predict(X)[0]
    pred_24 = model_24.predict(X)[0]

    return {
        "city": city,
        "AQI_6h": round(pred_6, 2),
        "AQI_12h": round(pred_12, 2),
        "AQI_24h": round(pred_24, 2),
    }

# -----------------------
# TEST
# -----------------------
if __name__ == "__main__":
    try:
        result = predict_aqi("delhi")

        print("\nAQI Predictions:\n")
        for k, v in result.items():
            print(f"{k}: {v}")

    except Exception as e:
        print(f"Error: {e}")