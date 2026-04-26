import pandas as pd

# -------------------------
# Load dataset
# -------------------------
FILE_PATH = "data/cleaned/04_shared/master_cleaned.csv"

df = pd.read_csv(FILE_PATH)

print("\n========== BASIC INFO ==========\n")
print(df.info())

# -------------------------
# Columns
# -------------------------
print("\n========== COLUMNS ==========\n")
print(list(df.columns))

# -------------------------
# Unique cities
# -------------------------
print("\n========== UNIQUE CITIES ==========\n")
cities = df["city"].unique()
print(f"Total cities: {len(cities)}")
print(cities[:20])  # show first 20

# -------------------------
# Check numeric ranges
# -------------------------
print("\n========== NUMERIC SUMMARY ==========\n")
numeric_cols = [
    "pm2_5_ugm3", "pm10_ugm3", "co_ugm3",
    "no2_ugm3", "so2_ugm3", "o3_ugm3",
    "us_aqi"
]

print(df[numeric_cols].describe())

# -------------------------
# Sample rows
# -------------------------
print("\n========== SAMPLE ROWS ==========\n")
print(df.head(5))

# -------------------------
# Check missing values
# -------------------------
print("\n========== MISSING VALUES ==========\n")
print(df.isnull().sum().sort_values(ascending=False).head(15))

# -------------------------
# Datetime parsing check
# -------------------------
print("\n========== DATETIME CHECK ==========\n")
df["datetime"] = pd.to_datetime(df["datetime"], errors="coerce")
print(df["datetime"].head())

# -------------------------
# Units explanation (manual context)
# -------------------------
print("\n========== UNIT CONTEXT ==========\n")

unit_info = {
    "pm2_5_ugm3": "µg/m³",
    "pm10_ugm3": "µg/m³",
    "co_ugm3": "µg/m³",
    "no2_ugm3": "µg/m³",
    "so2_ugm3": "µg/m³",
    "o3_ugm3": "µg/m³",
    "humidity_percent": "%",
    "pressure_msl_hpa": "hPa",
    "wind_gusts_kmh": "km/h",
    "precipitation_mm": "mm",
}

for col, unit in unit_info.items():
    print(f"{col}: {unit}")

# -------------------------
# Correlation with AQI
# -------------------------
print("\n========== CORRELATION WITH AQI ==========\n")

corr = df[numeric_cols].corr()["us_aqi"].sort_values(ascending=False)
print(corr)