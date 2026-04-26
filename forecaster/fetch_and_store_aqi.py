import os
import requests
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

# -----------------------
# Load API key
# -----------------------
load_dotenv()
API_KEY = os.getenv("OPENWEATHER_API_KEY")

# -----------------------
# City coordinates (ALL 29)
# -----------------------
CITIES = {
    "agartala": (23.8315, 91.2868),
    "ahmedabad": (23.0225, 72.5714),
    "aizawl": (23.7271, 92.7176),
    "bengaluru": (12.9716, 77.5946),
    "bhopal": (23.2599, 77.4126),
    "bhubaneswar": (20.2961, 85.8245),
    "chandigarh": (30.7333, 76.7794),
    "chennai": (13.0827, 80.2707),
    "dehradun": (30.3165, 78.0322),
    "delhi": (28.6139, 77.2090),
    "gangtok": (27.3389, 88.6065),
    "gurugram": (28.4595, 77.0266),
    "guwahati": (26.1445, 91.7362),
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

# -----------------------
# CPCB Breakpoints
# -----------------------
BREAKPOINTS = {
    "pm2_5": [(0,30,0,50),(31,60,51,100),(61,90,101,200),(91,120,201,300),(121,250,301,400),(251,500,401,500)],
    "pm10": [(0,50,0,50),(51,100,51,100),(101,250,101,200),(251,350,201,300),(351,430,301,400),(431,600,401,500)],
    "no2": [(0,40,0,50),(41,80,51,100),(81,180,101,200),(181,280,201,300),(281,400,301,400),(401,1000,401,500)],
    "so2": [(0,40,0,50),(41,80,51,100),(81,380,101,200),(381,800,201,300),(801,1600,301,400),(1601,2000,401,500)],
    "o3": [(0,50,0,50),(51,100,51,100),(101,168,101,200),(169,208,201,300),(209,748,301,400),(749,1000,401,500)],
    "co": [(0,1,0,50),(1.1,2,51,100),(2.1,10,101,200),(10.1,17,201,300),(17.1,34,301,400),(34.1,50,401,500)]
}

# -----------------------
# Sub-index calculator
# -----------------------
def calculate_sub_index(value, pollutant):
    if value is None:
        return None

    for Clow, Chigh, Ilow, Ihigh in BREAKPOINTS[pollutant]:
        if Clow <= value <= Chigh:
            return ((Ihigh - Ilow)/(Chigh - Clow)) * (value - Clow) + Ilow

    return None

# -----------------------
# Final AQI calculator
# -----------------------
def calculate_aqi(components):
    sub_indices = []

    # Convert CO µg/m³ → mg/m³
    components["co"] = components.get("co", 0) / 1000

    for pollutant in ["pm2_5", "pm10", "no2", "so2", "o3", "co"]:
        val = components.get(pollutant)
        sub = calculate_sub_index(val, pollutant)
        if sub is not None:
            sub_indices.append(sub)

    return round(max(sub_indices)) if sub_indices else None

# -----------------------
# Fetch data
# -----------------------
def fetch_city_data(city, lat, lon):
    url = f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={API_KEY}"

    response = requests.get(url)
    if response.status_code != 200:
        raise Exception(response.text)

    data = response.json()["list"][0]["components"]

    # 🔥 CRITICAL: round to exact hour
    now = datetime.now().replace(minute=0, second=0, microsecond=0)

    aqi = calculate_aqi(data.copy())

    return {
        "city": city,
        "datetime": now.strftime("%Y-%m-%d %H:%M:%S"),

        "pm2_5_ugm3": data.get("pm2_5"),
        "pm10_ugm3": data.get("pm10"),
        "co_ugm3": data.get("co"),
        "no2_ugm3": data.get("no2"),
        "so2_ugm3": data.get("so2"),
        "o3_ugm3": data.get("o3"),

        "AQI": aqi,

        "hour": now.hour,
        "day_of_week": now.weekday(),
        "month": now.month,
        "is_weekend": 1 if now.weekday() in [5, 6] else 0,
    }

# -----------------------
# Main
# -----------------------
def main():
    rows = []

    for city, (lat, lon) in CITIES.items():
        try:
            row = fetch_city_data(city, lat, lon)
            rows.append(row)
            print(f"Fetched: {city}")
        except Exception as e:
            print(f"Error fetching {city}: {e}")

    df = pd.DataFrame(rows)

    EXPECTED_COLUMNS = [
        "city", "datetime",
        "pm2_5_ugm3", "pm10_ugm3", "co_ugm3",
        "no2_ugm3", "so2_ugm3", "o3_ugm3",
        "AQI", "hour", "day_of_week", "month",
        "is_weekend"
    ]

    df = df[EXPECTED_COLUMNS]

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(BASE_DIR, "hourlyData.csv")

    # -----------------------
    # Append + Deduplicate
    # -----------------------
    if os.path.exists(file_path):
        old_df = pd.read_csv(file_path)
        df = pd.concat([old_df, df])

        # 🔥 remove duplicates (important for cron/GH actions)
        df = df.drop_duplicates(subset=["city", "datetime"])

    df.to_csv(file_path, index=False)

    print("Data saved successfully")

if __name__ == "__main__":
    main()