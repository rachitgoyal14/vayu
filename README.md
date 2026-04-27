<p align="center">
  <img src="frontend/public/image.png" alt="Vayu Logo" width="120" />
</p>

# Vayu — Air Quality Intelligence System

A production-grade AI-powered air quality forecasting system for 29 Indian cities.

---

**Models:** XGBoost | SHAP | NMF  
**Stack:** FastAPI | React | Supabase | GitHub Actions

---

## UI Overview

### Landing Dashboard
The main dashboard displays real-time AQI for the selected city, including current pollutant levels (PM2.5, PM10, CO, NO2, SO2, O3), forecast cards for 6h/12h/24h windows, and an atmospheric background that adapts to air quality severity.

![Landing dashboard showing real-time AQI and forecasts](docs/images/heroSection.png)

### Multi-City Sensor Grid
The national network grid shows AQI readings across all 29 supported Indian cities in a scrollable card layout, enabling quick comparison of air quality nationwide.

![Multi-city AQI grid showing all supported cities](docs/images/cityGRID.png)

### Historical Trends
The last 24-hour readings chart visualizes temporal AQI patterns using bar charts, helping users identify daily patterns and pollution spikes.

![24-hour AQI trend visualization](docs/images/last24HoursReadings.png)

### Forecast Explanation
SHAP-based explanations break down forecast contributions by feature, showing how each pollutant and time feature impacts the predicted AQI value.

![SHAP feature importance breakdown](docs/images/forecastExplainer.png)

---

## Overview

Vayu is an end-to-end air quality forecasting system that combines multiple data sources with machine learning to deliver accurate AQI predictions.

**Data sources:**
- WAQI API provides multi-station median AQI (authoritative display values)
- OpenWeather Air Pollution API provides pollutant concentrations (PM2.5, PM10, CO, NO2, SO2, O3)

**ML pipeline:**
- XGBoost regressors predict AQI at 6-hour, 12-hour, and 24-hour horizons
- XGBoost classifier maps AQI to CPCB's 6-category scale (Good → Severe)
- SHAP explainers provide interpretable feature importance for each prediction
- NMF enables latent pattern discovery in pollutant data

The system runs hourly via GitHub Actions, stores data in Supabase, and serves predictions through FastAPI endpoints with a React dashboard.

---

## Architecture

```
WAQI API          →  Multi-station median AQI (display value)
OpenWeather API   →  Pollutant concentrations (model input)
GitHub Actions    →  Hourly cron → Supabase (aqi_data table)
FastAPI          →  ML inference + REST API
React            →  Interactive dashboard
```

---

## Features

- Real-time AQI for 29 Indian cities
- ML forecasting: 6h, 12h, 24h predictions
- CPCB 6-category classification
- SHAP-based explanations for each forecast
- Historical 24-hour trend visualization
- Multi-city sensor network overview
- Automated hourly data pipeline

---

## Models

| Model | Type | Purpose |
|-------|------|---------|
| xgb_6h.pkl | XGBoost Regressor | 6-hour AQI forecast |
| xgb_12h.pkl | XGBoost Regressor | 12-hour AQI forecast |
| xgb_24h.pkl | XGBoost Regressor | 24-hour AQI forecast |
| best_classifier.pkl | XGBoost Classifier | CPCB AQI category |
| shap_explainer_*.pkl | SHAP TreeExplainer | Feature importance |
| nmf_model.pkl | NMF | Latent pattern analysis |
| city_encoder.pkl | LabelEncoder | City name encoding |

---

## Data Pipeline

1. **GitHub Actions** triggers hourly (`cron: '0 * * * *'`)
2. Fetches AQI from WAQI search endpoint (aggregates multiple stations, takes median)
3. Fetches pollutants from OpenWeather air pollution API (PM2.5, PM10, CO, NO2, SO2, O3)
4. Stores to Supabase `aqi_data` table with city, datetime, AQI, pollutants, and time features
5. Backend reads latest row for lag features + fetches live data for inference

---

## Project Structure

```
vayu-sul/
├── backend/              # FastAPI inference server
│   ├── main.py         # API routes & ML pipeline
│   ├── utils/         # Supabase client, lag features
│   └── requirements.txt
├── frontend/           # React + TypeScript UI
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   └── App.tsx
│   ├── public/
│   └── package.json
├── models/            # Trained ML artifacts
├── pipelines/        # Data ingestion scripts
├── notebooks/        # EDA and model training
├── data/             # Datasets (raw + cleaned)
├── docs/             # Documentation + images
└── .github/workflows/
```

---

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp ../.env.example .env  # Add your API keys
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp ../.env.example .env
npm run dev
```

---

## Environment Variables

Create `.env` from `.env.example`:

**Backend:**
- `OPENWEATHER_API_KEY` — OpenWeather Air Pollution API key
- `WAQI_API_KEY` — WAQI API token
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_KEY` — Supabase anon key

**Frontend:**
- `VITE_OPENWEATHER_API_KEY`
- `VITE_API_BASE_URL` — Backend URL (default: `http://localhost:8000`)

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/cities` | GET | List supported cities |
| `/history/24h/all` | GET | 24h history for all cities |
| `/predict/forecast/realtime` | POST | Real-time forecast |
| `/predict/classify` | POST | AQI category |
| `/predict/explain/forecast` | POST | SHAP explanations |

### Example: Realtime Forecast

```bash
curl -X POST http://localhost:8000/predict/forecast/realtime \
  -H "Content-Type: application/json" \
  -d '{"city": "delhi"}'
```

```json
{
  "city": "delhi",
  "datetime": "2026-04-27T14:00:00",
  "current_aqi": 187,
  "current": {
    "pm2_5": 95.4,
    "pm10": 142.3,
    "co": 620.0,
    "no2": 28.5,
    "so2": 12.1,
    "o3": 45.2,
    "hour": 14,
    "month": 4,
    "day_of_week": 0,
    "is_weekend": 0
  },
  "forecast": {
    "6h": {"aqi": 192, "category": "Poor", "color": "#f97316"},
    "12h": {"aqi": 201, "category": "Poor", "color": "#f97316"},
    "24h": {"aqi": 178, "category": "Moderate", "color": "#eab308"}
  }
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Backend | FastAPI, Python 3.11+ |
| Frontend | React 18, TypeScript, Vite |
| ML | XGBoost, SHAP, NMF, Pandas |
| Database | Supabase |
| Pipeline | GitHub Actions |
| Styling | Tailwind CSS, Framer Motion |

---

## Supported Cities

Agartala, Ahmedabad, Aizawl, Bengaluru, Bhopal, Bhubaneswar, Chandigarh, Chennai, Dehradun, Delhi, Gangtok, Gurugram, Guwahati, Hyderabad, Imphal, Itanagar, Jaipur, Kohima, Kolkata, Lucknow, Mumbai, Panaji, Patna, Raipur, Ranchi, Shillong, Shimla, Thiruvananthapuram, Visakhapatnam

---

## Deployment

Deployment: Coming soon

---

## License

MIT License — See [LICENSE](LICENSE) for details.