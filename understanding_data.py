"""
VAYU — Comprehensive Data Analysis Script
Reads ALL .csv and .xlsx files, identifies their schema type,
and produces a full human-readable report.

Usage:
    python vayu_data_analysis.py

Output:
    - vayu_full_analysis.txt   → complete printed report
    - vayu_schema_map.csv      → one row per file with schema + stats
"""

import os, glob, warnings, sys
import pandas as pd
import numpy as np
from pathlib import Path
from collections import defaultdict

warnings.filterwarnings("ignore")
pd.set_option("display.max_columns", 20)
pd.set_option("display.width", 120)

# ── CONFIG ─────────────────────────────────────────────────────────────────
DATA_ROOT = "./data"
# ───────────────────────────────────────────────────────────────────────────

# Known source mapping (partial — from what user provided)
KNOWN_SOURCES = {
    "kaggle-2015-o-2020.csv"   : "Kaggle: rohanrao/air-quality-data-in-india (2015–2020)",
    "AP001.csv"                : "Kaggle: abhisheksjha/time-series-air-quality-data (CAAQMS hourly)",
    "delhi-weather-aqi-2025.csv": "Kaggle: sohails07/delhi-weather-and-aqi-dataset-2025",
    "delhi_ncr_aqi_dataset.csv": "Kaggle: vishardmehta/delhi-pollution-aqi-dataset",
    "bengaluru_combined.csv"   : "Kaggle: rajanbhateja/indian-cities-aqi-2020-2024",
    "air-quality-india.csv"    : "Kaggle: fedesoriano/air-quality-data-in-india",
    "Cleaned_NSUT.xlsx"        : "Kaggle: kunshbhatia/delhi-air-quality-dataset",
    "AQI Data.csv"             : "Kaggle: jimschacko/bangalore-5-year-aqi-data",
}
# Files ending in _AQIBulletins.csv come from the CPCB bulletin system
# Files named Dataset_AQI*.xlsx come from Kaggle: ishankat/real-time-aqi-india-20232025

# ── READERS ────────────────────────────────────────────────────────────────

def try_read(fp, nrows=None):
    ext = Path(fp).suffix.lower()
    try:
        if ext in [".xlsx", ".xls"]:
            xl = pd.ExcelFile(fp)
            dfs = []
            for sheet in xl.sheet_names:
                try:
                    df = pd.read_excel(fp, sheet_name=sheet, nrows=nrows)
                    if not df.empty and df.shape[1] > 1:
                        dfs.append(df)
                except Exception:
                    continue
            return max(dfs, key=len) if dfs else None

        # CSV — try encodings + delimiters
        for enc in ["utf-8", "latin-1", "cp1252", "utf-16"]:
            for sep in [",", ";", "\t", "|"]:
                try:
                    df = pd.read_csv(fp, sep=sep, encoding=enc,
                                     nrows=nrows, low_memory=False,
                                     on_bad_lines="skip")
                    if df.shape[1] > 1:
                        return df
                except Exception:
                    continue
    except Exception:
        pass
    return None


# ── SCHEMA DETECTOR ────────────────────────────────────────────────────────

def detect_schema(df, filename):
    """
    Returns (schema_code, schema_label, detail_dict)

    Schema codes:
      CAAQMS_HOURLY    — Raw hourly sensor data, wide format (AP001 style)
      REALTIME_WIDE    — Real-time snapshot, wide pollutants + AQI col (Dataset_AQI* style)
      LONG_FORMAT      — One row per pollutant per station (pollutant_id column)
      AQI_BULLETIN     — Daily city-level AQI bulletin (Air Quality + Index Value cols)
      WEATHER_PM25     — Weather params + only PM2.5, no proper date
      MULTI_CITY_HIST  — Multi-city historical with AQI and pollutant breakdowns
      UNKNOWN          — Doesn't match any known pattern
    """
    cols = [c.strip().lower() for c in df.columns]
    cols_orig = list(df.columns)

    detail = {
        "columns_raw"   : " | ".join(cols_orig),
        "has_datetime"  : False,
        "has_pollutants": False,
        "has_aqi"       : False,
        "has_location"  : False,
        "pollutants_found": [],
        "date_sample"   : "",
    }

    POLL_KW   = ["pm2", "pm10", "no2", "so2", " co", "ozone", "o3", "nh3", "nox", "benzene", "toluene"]
    DATE_KW   = ["date", "time", "from date", "to date", "timestamp", "last_update"]
    LOC_KW    = ["city", "state", "station", "location", "site"]

    detail["has_datetime"]   = any(any(k in c for k in DATE_KW) for c in cols)
    detail["has_pollutants"] = any(any(k in c for k in POLL_KW) for c in cols)
    detail["has_aqi"]        = any("aqi" in c or "air quality" in c or "index value" in c for c in cols)
    detail["has_location"]   = any(any(k in c for k in LOC_KW) for c in cols)
    detail["pollutants_found"] = [c for c in cols_orig
                                   if any(k in c.lower() for k in POLL_KW)]

    # Date sample
    for col in df.columns:
        if any(k in col.lower() for k in DATE_KW):
            try:
                detail["date_sample"] = str(df[col].dropna().iloc[0])[:25]
            except Exception:
                pass
            break

    # --- Schema detection logic ---

    # LONG_FORMAT: has pollutant_id column
    if "pollutant_id" in cols:
        return "LONG_FORMAT", "Long Format (1 row/pollutant)", detail

    # AQI_BULLETIN: has 'air quality' + 'index value' or 'prominent pollutant'
    if (any("air quality" in c for c in cols) and
            any("index value" in c or "prominent" in c for c in cols)):
        return "AQI_BULLETIN", "AQI Bulletin (daily city-level)", detail

    # CAAQMS_HOURLY: has 'from date' + multiple raw pollutant cols (no AQI col)
    has_from_date = any("from date" in c or "from_date" in c for c in cols)
    has_many_polls = sum(any(k in c for k in POLL_KW) for c in cols) >= 4
    if has_from_date and has_many_polls:
        return "CAAQMS_HOURLY", "Raw Hourly Sensor (CAAQMS wide format)", detail

    # REALTIME_WIDE: has city/station + aqi col + pollutant cols + time
    has_city = any("city" in c for c in cols)
    has_aqi_col = any(c == "aqi" for c in cols)
    if has_city and has_aqi_col and detail["has_pollutants"]:
        return "REALTIME_WIDE", "Real-time Snapshot (wide, AQI + pollutants)", detail

    # MULTI_CITY_HIST: has city + date + aqi but no raw pollutant detail
    if has_city and detail["has_datetime"] and detail["has_aqi"]:
        return "MULTI_CITY_HIST", "Multi-city Historical AQI", detail

    # WEATHER_PM25: has weather-like cols (T, TM, SLP, H) with only PM2.5
    weather_cols = ["t", "tm", "slp", "h", "vv", "v", "vm"]
    if sum(c in weather_cols for c in cols) >= 3:
        return "WEATHER_PM25", "Weather + PM2.5 only (limited use)", detail

    if detail["has_pollutants"] or detail["has_aqi"]:
        return "UNKNOWN_AQ", "Air quality data (schema unclear)", detail

    return "IRRELEVANT", "No air quality data detected", detail


# ── STATS EXTRACTOR ────────────────────────────────────────────────────────

def extract_stats(df, schema, fname):
    stats = {
        "rows"         : len(df),
        "cols"         : len(df.columns),
        "date_range"   : "N/A",
        "cities"       : "N/A",
        "states"       : "N/A",
        "stations"     : "N/A",
        "missing_pct"  : round(df.isnull().mean().mean() * 100, 1),
        "sentinel_999" : False,
        "aqi_range"    : "N/A",
        "pollutants"   : "N/A",
    }

    cols = [c.lower() for c in df.columns]

    # Date range
    for col in df.columns:
        if any(k in col.lower() for k in ["date", "time", "from date", "last_update"]):
            try:
                parsed = pd.to_datetime(df[col], errors="coerce", infer_datetime_format=True)
                if parsed.notna().mean() > 0.5:
                    stats["date_range"] = f"{parsed.min().date()} → {parsed.max().date()}"
            except Exception:
                pass
            break

    # Cities / states / stations
    for col in df.columns:
        cl = col.lower()
        if cl == "city" or cl == "city name":
            stats["cities"] = f"{df[col].nunique()} unique ({', '.join(str(x) for x in df[col].dropna().unique()[:4])}...)"
        if cl == "state":
            stats["states"] = f"{df[col].nunique()} unique"
        if cl in ["station", "station name", "location", "site"]:
            stats["stations"] = f"{df[col].nunique()} unique"

    # For long format, count unique cities from city col
    if schema == "LONG_FORMAT" and "city" in cols:
        city_col = [c for c in df.columns if c.lower() == "city"][0]
        stats["cities"] = f"{df[city_col].nunique()} unique ({', '.join(str(x) for x in df[city_col].dropna().unique()[:5])}...)"

    # AQI range
    for col in df.columns:
        if col.lower() in ["aqi", "index value"]:
            try:
                vals = pd.to_numeric(df[col], errors="coerce").dropna()
                real = vals[(vals > 0) & (vals <= 500)]
                stats["aqi_range"] = f"{real.min():.0f} – {real.max():.0f} (mean {real.mean():.0f})"
                if (vals == 999).any():
                    stats["sentinel_999"] = True
            except Exception:
                pass

    # Check sentinel 999 in any numeric col
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if (df[numeric_cols] == 999).any().any():
        stats["sentinel_999"] = True

    # Pollutants list
    POLL_KW = ["pm2", "pm10", "no2", "so2", " co", "ozone", "o3", "nh3", "nox", "benzene", "toluene", "xylene"]
    polls = [c for c in df.columns if any(k in c.lower() for k in POLL_KW)]
    stats["pollutants"] = ", ".join(polls) if polls else "None detected"

    return stats


# ══════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════

all_files = (
    glob.glob(os.path.join(DATA_ROOT, "**/*.csv"),  recursive=True) +
    glob.glob(os.path.join(DATA_ROOT, "**/*.xlsx"), recursive=True) +
    glob.glob(os.path.join(DATA_ROOT, "**/*.xls"),  recursive=True)
)
all_files = [f for f in all_files if "cleaned" not in f.lower()
             and "analysis" not in f.lower()]

# Output buffer — write to file AND print
lines = []
def log(s=""):
    lines.append(s)
    print(s)

log("=" * 75)
log("  VAYU — FULL DATA ANALYSIS REPORT")
log(f"  Root: {os.path.abspath(DATA_ROOT)}")
log(f"  Total files found: {len(all_files)}")
log("=" * 75)

schema_records  = []
schema_groups   = defaultdict(list)
failed_files    = []

for i, fp in enumerate(all_files, 1):
    fname = os.path.basename(fp)
    fsize = round(os.path.getsize(fp) / 1024, 1)

    sys.stdout.write(f"\r  Reading [{i:>3}/{len(all_files)}] {fname[:55]:<55}")
    sys.stdout.flush()

    df = try_read(fp)

    if df is None or df.empty:
        failed_files.append(fp)
        schema_records.append({
            "file": fname, "path": fp, "schema": "FAILED",
            "schema_label": "Could not read", "size_kb": fsize,
        })
        continue

    schema_code, schema_label, detail = detect_schema(df, fname)
    stats = extract_stats(df, schema_code, fname)

    rec = {
        "file"         : fname,
        "path"         : fp,
        "schema"       : schema_code,
        "schema_label" : schema_label,
        "size_kb"      : fsize,
        "source"       : KNOWN_SOURCES.get(fname,
                         "CPCB AQI Bulletin" if "_AQIBulletins" in fname else
                         "Kaggle: ishankat/real-time-aqi" if fname.startswith("Dataset_AQI") else
                         "Unknown"),
        **stats,
        **{k: str(v)[:100] for k, v in detail.items()},
    }
    schema_records.append(rec)
    schema_groups[schema_code].append((fp, fname, df, stats, detail))

print()  # newline after progress

# ── Per-schema detailed report ────────────────────────────────────────────

SCHEMA_ORDER = [
    "CAAQMS_HOURLY",
    "REALTIME_WIDE",
    "LONG_FORMAT",
    "AQI_BULLETIN",
    "MULTI_CITY_HIST",
    "WEATHER_PM25",
    "UNKNOWN_AQ",
    "IRRELEVANT",
]

RELEVANCE_NOTE = {
    "CAAQMS_HOURLY"  : "BEST for regression — raw pollutant readings, hourly, no AQI col (you compute it)",
    "REALTIME_WIDE"  : "BEST for regression — has AQI + all pollutants already",
    "LONG_FORMAT"    : "GOOD — needs pivoting to wide, covers all states in one file",
    "AQI_BULLETIN"   : "GOOD for clustering — city-level daily AQI, no raw pollutants",
    "MULTI_CITY_HIST": "MODERATE — multi-city, check if raw pollutants or just AQI",
    "WEATHER_PM25"   : "LOW — only PM2.5 + weather, missing 5 of 6 pollutants",
    "UNKNOWN_AQ"     : "REVIEW — has some AQ data, schema unclear",
    "IRRELEVANT"     : "SKIP — no air quality data",
}

log()
log("=" * 75)
log("  SCHEMA BREAKDOWN SUMMARY")
log("=" * 75)
total_relevant_rows = 0

for code in SCHEMA_ORDER:
    group = schema_groups.get(code, [])
    if not group:
        continue
    total_rows = sum(s["rows"] for _, _, _, s, _ in group)
    if code not in ["IRRELEVANT", "UNKNOWN_AQ", "WEATHER_PM25"]:
        total_relevant_rows += total_rows
    log(f"\n  [{code}]")
    log(f"  Files : {len(group)}")
    log(f"  Rows  : {total_rows:,}")
    log(f"  Use   : {RELEVANCE_NOTE.get(code,'')}")

log()
log(f"  TOTAL USABLE ROWS (relevant schemas): {total_relevant_rows:,}")
log(f"  FAILED TO READ: {len(failed_files)} files")

# ── Detailed per-schema breakdown ──────────────────────────────────────────

for code in SCHEMA_ORDER:
    group = schema_groups.get(code, [])
    if not group:
        continue

    log()
    log("─" * 75)
    log(f"  SCHEMA: {code} — {RELEVANCE_NOTE.get(code,'')}")
    log("─" * 75)

    for fp, fname, df, stats, detail in group:
        source = KNOWN_SOURCES.get(fname,
                 "CPCB AQI Bulletin" if "_AQIBulletins" in fname else
                 "Kaggle: ishankat/real-time-aqi" if fname.startswith("Dataset_AQI") else
                 "Unknown")
        log()
        log(f"  File         : {fname}")
        log(f"  Source       : {source}")
        log(f"  Size         : {round(os.path.getsize(fp)/1024,1)} KB")
        log(f"  Shape        : {stats['rows']:,} rows x {stats['cols']} cols")
        log(f"  Date range   : {stats['date_range']}")
        log(f"  Cities       : {stats['cities']}")
        log(f"  Stations     : {stats['stations']}")
        log(f"  States       : {stats['states']}")
        log(f"  AQI range    : {stats['aqi_range']}")
        log(f"  Missing avg  : {stats['missing_pct']}%")
        log(f"  Sentinel 999 : {'YES — needs cleaning' if stats['sentinel_999'] else 'No'}")
        log(f"  Pollutants   : {stats['pollutants']}")
        log(f"  All columns  : {detail['columns_raw'][:120]}")

# ── Failed files ──────────────────────────────────────────────────────────

if failed_files:
    log()
    log("─" * 75)
    log(f"  FAILED TO READ ({len(failed_files)} files)")
    log("─" * 75)
    for fp in failed_files:
        log(f"  {os.path.basename(fp)}")

# ── What you have vs what you need ────────────────────────────────────────

log()
log("=" * 75)
log("  WHAT YOU HAVE vs WHAT YOU NEED FOR VAYU")
log("=" * 75)
log("""
  TARGET: Predictive Modeling (AQI regression + classification)
          + Unsupervised Clustering of Indian Urban Centres

  REQUIREMENT                         STATUS
  ─────────────────────────────────── ──────────────────────────────────
  Raw pollutant readings              CAAQMS_HOURLY files (AP*.csv etc.)
  (PM2.5, PM10, NO2, SO2, CO, O3)

  AQI as target variable              REALTIME_WIDE (Dataset_AQI*.xlsx)
  (numeric + category)                Also computable from CAAQMS files

  Multiple cities for clustering      AQI_BULLETIN files (296 cities)
                                      + LONG_FORMAT (pan-India snapshot)

  Temporal coverage (dates)           2015–2026 across different files

  Geographic coverage                 Pan-India: 138+ cities, all states

  GAPS
  ─────────────────────────────────── ──────────────────────────────────
  NH3 data                            Only in CAAQMS files, not bulletins
  Station-level coordinates           Only in LONG_FORMAT + REALTIME_WIDE
  Consistent granularity              CAAQMS=hourly, bulletins=daily
""")

# ── Save outputs ──────────────────────────────────────────────────────────

schema_df = pd.DataFrame(schema_records)
schema_df.to_csv("vayu_schema_map.csv", index=False)

with open("vayu_full_analysis.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

log()
log("=" * 75)
log("  SAVED")
log("  vayu_schema_map.csv     — one row per file with schema + stats")
log("  vayu_full_analysis.txt  — this full report as a text file")
log("=" * 75)