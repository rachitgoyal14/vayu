import pandas as pd
from fastapi import HTTPException
from .supabase_client import supabase


def get_lag_features(city: str):
    try:
        response = (
            supabase
            .table("aqi_data")
            .select("datetime, AQI")
            .eq("city", city.lower())
            .order("datetime")
            .execute()
        )

        if not response.data:
            raise ValueError("No data found")

        df = pd.DataFrame(response.data)
        df["datetime"] = pd.to_datetime(df["datetime"])
        df = df.sort_values("datetime")
        df = df.ffill()

        if len(df) == 0:
            raise ValueError("Empty dataframe")

        aqi_series = df["AQI"].clip(upper=300)
        aqi_series = aqi_series.clip(lower=0)

        lag_1 = aqi_series.iloc[-1]
        lag_6 = aqi_series.iloc[-6] if len(df) >= 6 else lag_1
        lag_24 = aqi_series.iloc[-24] if len(df) >= 24 else lag_1

        return lag_1, lag_6, lag_24

    except Exception as e:
        raise HTTPException(500, f"Lag feature error: {str(e)}")