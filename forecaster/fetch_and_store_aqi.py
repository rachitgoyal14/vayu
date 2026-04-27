import os
import requests
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client
from statistics import median

load_dotenv()

WAQI_API_KEY = os.getenv("WAQI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

CITIES = [
    "agartala","ahmedabad","aizawl","bengaluru","bhopal","bhubaneswar",
    "chandigarh","chennai","dehradun","delhi","gangtok","gurugram",
    "guwahati","hyderabad","imphal","itanagar","jaipur","kohima",
    "kolkata","lucknow","mumbai","panaji","patna","raipur",
    "ranchi","shillong","shimla","thiruvananthapuram","visakhapatnam"
]

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

CPCB_BREAKPOINTS = {
    "pm2_5": [(0,30,0,50),(31,60,51,100),(61,90,101,200),(91,120,201,300),(121,250,301,400),(251,500,401,500)],
    "pm10":  [(0,50,0,50),(51,100,51,100),(101,250,101,200),(251,350,201,300),(351,430,301,400),(431,600,401,500)],
    "no2":   [(0,40,0,50),(41,80,51,100),(81,180,101,200),(181,280,201,300),(281,400,301,400),(401,1000,401,500)],
    "so2":   [(0,40,0,50),(41,80,51,100),(81,380,101,200),(381,800,201,300),(801,1600,301,400),(1601,2000,401,500)],
    "o3":    [(0,50,0,50),(51,100,51,100),(101,168,101,200),(169,208,201,300),(209,748,301,400),(749,1000,401,500)],
    "co":    [(0,1,0,50),(1.1,2,51,100),(2.1,10,101,200),(10.1,17,201,300),(17.1,34,301,400),(34.1,50,401,500)],
}

def safe_float(val):
    try:
        if val in [None, "-", "", "NA"]:
            return None
        return float(val)
    except:
        return None

def reverse_sub_index(sub_index: float, pollutant: str) -> float:
    for c_low, c_high, i_low, i_high in CPCB_BREAKPOINTS[pollutant]:
        if i_low <= sub_index <= i_high:
            return round(((sub_index - i_low) / (i_high - i_low)) * (c_high - c_low) + c_low, 4)
    return CPCB_BREAKPOINTS[pollutant][-1][1]

def fetch_waqi_multi(city: str) -> dict:
    """
    Fetch multiple stations for a city via WAQI search endpoint.
    Returns median AQI and averaged pollutant concentrations.
    """
    url = f"https://api.waqi.info/search/?token={WAQI_API_KEY}&keyword={city}"
    response = requests.get(url, timeout=10)

    if response.status_code != 200:
        raise Exception(f"WAQI HTTP error: {response.status_code}")

    data = response.json()
    if data.get("status") != "ok":
        raise Exception(f"WAQI error: {data}")

    stations = data.get("data", [])
    if not stations:
        raise Exception(f"No stations found for {city}")

    # Collect valid AQI readings and pollutant sub-indices
    aqi_values = []
    pm25_sis, pm10_sis, no2_sis, so2_sis, o3_sis, co_sis = [], [], [], [], [], []

    for station in stations:
        aqi = safe_float(station.get("aqi"))
        if aqi is None or aqi <= 0 or aqi > 500:
            continue

        aqi_values.append(aqi)

        # Each station in search results has iaqi nested inside station
        iaqi = station.get("station", {})
        # WAQI search result structure is flat — aqi is top level
        # pollutant sub-indices are not returned in search results
        # so we collect AQI only and use geo for pollutants

    if not aqi_values:
        raise Exception(f"No valid AQI readings for {city}")

    median_aqi = median(aqi_values)

    # Now fetch pollutants from geo endpoint for the city center
    lat, lon = CITY_COORDS[city.lower()]
    geo_url = f"https://api.waqi.info/feed/geo:{lat};{lon}/?token={WAQI_API_KEY}"
    geo_response = requests.get(geo_url, timeout=10)

    if geo_response.status_code != 200:
        raise Exception(f"WAQI geo HTTP error: {geo_response.status_code}")

    geo_data = geo_response.json()
    if geo_data.get("status") != "ok":
        raise Exception(f"WAQI geo error: {geo_data}")

    iaqi = geo_data["data"].get("iaqi", {})

    def get_iaqi(key):
        val = iaqi.get(key, {}).get("v")
        return safe_float(val)

    pm25_si = get_iaqi("pm25")
    pm10_si = get_iaqi("pm10")
    no2_si  = get_iaqi("no2")
    so2_si  = get_iaqi("so2")
    o3_si   = get_iaqi("o3")
    co_si   = get_iaqi("co")

    pm2_5   = reverse_sub_index(pm25_si, "pm2_5") if pm25_si is not None else 45.0
    pm10    = reverse_sub_index(pm10_si, "pm10")  if pm10_si  is not None else 75.0
    no2     = reverse_sub_index(no2_si,  "no2")   if no2_si   is not None else 40.0
    so2     = reverse_sub_index(so2_si,  "so2")   if so2_si   is not None else 20.0
    o3      = reverse_sub_index(o3_si,   "o3")    if o3_si    is not None else 30.0
    co_mgm3 = reverse_sub_index(co_si,   "co")    if co_si    is not None else 0.5
    co_ugm3 = co_mgm3 * 1000

    print(f"  [{city}] Stations found: {len(aqi_values)} | AQIs: {sorted(aqi_values)} | Median: {median_aqi}")

    return {
        "aqi":   int(median_aqi),
        "pm2_5": pm2_5,
        "pm10":  pm10,
        "co":    co_ugm3,
        "no2":   no2,
        "so2":   so2,
        "o3":    o3,
    }


def fetch_city_data(city: str) -> dict:
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    data = fetch_waqi_multi(city)

    return {
        "city":        city,
        "datetime":    now.isoformat(),
        "AQI":         data["aqi"],
        "pm2_5_ugm3":  data["pm2_5"],
        "pm10_ugm3":   data["pm10"],
        "co_ugm3":     data["co"],
        "no2_ugm3":    data["no2"],
        "so2_ugm3":    data["so2"],
        "o3_ugm3":     data["o3"],
        "hour":        now.hour,
        "day_of_week": now.weekday(),
        "month":       now.month,
        "is_weekend":  1 if now.weekday() in [5, 6] else 0,
    }


def main():
    rows = []

    for city in CITIES:
        try:
            row = fetch_city_data(city)
            rows.append(row)
            print(f"Fetched: {city} | AQI: {row['AQI']} | PM2.5: {row['pm2_5_ugm3']:.2f} | PM10: {row['pm10_ugm3']:.2f}")
        except Exception as e:
            print(f"Error fetching {city}: {e}")

    if rows:
        supabase.table("aqi_data").upsert(
            rows,
            on_conflict="city,datetime"
        ).execute()
        print(f"\nUpserted {len(rows)} rows")
    else:
        print("No rows fetched")


if __name__ == "__main__":
    main()