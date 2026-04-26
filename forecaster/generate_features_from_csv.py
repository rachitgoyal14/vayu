import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

# -----------------------
# Load Supabase client
# -----------------------
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------
# Load data from Supabase
# -----------------------
def load_data(city):
    response = supabase.table("aqi_data") \
        .select("*") \
        .eq("city", city) \
        .order("datetime") \
        .execute()
    df = pd.DataFrame(response.data)
    df["datetime"] = pd.to_datetime(df["datetime"])
    return df

# -----------------------
# Create lag features
# -----------------------
def add_lag_features(city_df):
    city_df["AQI_lag_1"] = city_df["AQI"].shift(1)
    city_df["AQI_lag_6"] = city_df["AQI"].shift(6)
    city_df["AQI_lag_24"] = city_df["AQI"].shift(24)
    return city_df

# -----------------------
# Get latest usable row
# -----------------------
def get_latest_features(city_df):
    if len(city_df) == 0:
        raise ValueError("No data available for this city.")

    city_df = city_df.ffill()
    latest_row = city_df.iloc[-1]

    def safe(val, fallback):
        return val if pd.notna(val) else fallback

    lag_1 = latest_row["AQI_lag_1"]
    lag_6 = safe(latest_row["AQI_lag_6"], lag_1)
    lag_24 = safe(latest_row["AQI_lag_24"], lag_6)

    features = {
        "pm2_5_ugm3": latest_row["pm2_5_ugm3"],
        "pm10_ugm3": latest_row["pm10_ugm3"],
        "co_ugm3": latest_row["co_ugm3"],
        "no2_ugm3": latest_row["no2_ugm3"],
        "so2_ugm3": latest_row["so2_ugm3"],
        "o3_ugm3": latest_row["o3_ugm3"],
        "hour": latest_row["hour"],
        "day_of_week": latest_row["day_of_week"],
        "month": latest_row["month"],
        "is_weekend": latest_row["is_weekend"],
        "AQI_lag_1": lag_1,
        "AQI_lag_6": lag_6,
        "AQI_lag_24": lag_24,
    }

    return features

# -----------------------
# MAIN FUNCTION
# -----------------------
def generate_features(city):
    df = load_data(city)
    df = add_lag_features(df)
    features = get_latest_features(df)
    return features

# -----------------------
# TEST
# -----------------------
if __name__ == "__main__":
    city = "delhi"
    try:
        features = generate_features(city)
        print("\nGenerated Features:\n")
        for k, v in features.items():
            print(f"{k}: {v}")
    except Exception as e:
        print(f"Error: {e}")