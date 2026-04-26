import type { City } from "./cityData";
import type { BackendAQICategory } from "./aqiUtils";

export interface PollutantData {
  pm2_5: number;
  pm10: number;
  co: number;
  no2: number;
  so2: number;
  o3: number;
  hour: number;
  month: number;
  day_of_week: number;
  is_weekend: 0 | 1;
}

interface ForecastHorizon {
  aqi: number;
  category: BackendAQICategory | string;
  color: string;
}

export interface ForecastResult {
  city: string;
  forecast: {
    "6h": ForecastHorizon;
    "12h": ForecastHorizon;
    "24h": ForecastHorizon;
  };
}

export interface ClassifyResult {
  city: string;
  predicted_category: string;
  probabilities: Record<string, number>;
}

export interface SHAPResult {
  shap_values: Record<string, number>;
}

export interface CityAQIData {
  city: City;
  pollutants: PollutantData;
  forecast: ForecastResult;
  classification: ClassifyResult;
  shap?: SHAPResult;
  current_aqi: number;
}
