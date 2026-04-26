import type { City } from "./cityData";
import type {
  CityAQIData,
  ClassifyResult,
  ForecastResult,
  PollutantData,
  SHAPResult,
} from "./types";
import { computeAQI } from "./aqiUtils";

type RawPollutants = Omit<PollutantData, "hour" | "month" | "day_of_week" | "is_weekend">;

interface PredictionPayload extends PollutantData {
  city: string;
}

interface OpenWeatherResponse {
  list?: Array<{
    components?: Partial<RawPollutants>;
  }>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

export class ApiError extends Error {
  source: "openweather" | "backend" | "unknown";

  constructor(message: string, source: "openweather" | "backend" | "unknown") {
    super(message);
    this.source = source;
  }
}

function getTimeFeatures(date = new Date()) {
  const jsDay = date.getDay(); // 0 (Sun) to 6 (Sat)
  const dayOfWeek = jsDay === 0 ? 7 : jsDay; // 1 (Mon) to 7 (Sun)

  return {
    hour: date.getHours(),
    month: date.getMonth() + 1,
    day_of_week: dayOfWeek,
    is_weekend: (dayOfWeek >= 6 ? 1 : 0) as 0 | 1,
  };
}

function createPredictionPayload(city: string, pollutants: PollutantData): PredictionPayload {
  return {
    city: city.toLowerCase(),
    ...pollutants,
  };
}

async function requestJSON<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      const errorBody = await response.text();
      const source = url.includes("openweathermap.org") ? "openweather" : "backend";
      throw new ApiError(
        `Request failed (${response.status}) for ${url}: ${errorBody || response.statusText}`,
        source,
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const source = url.includes("openweathermap.org") ? "openweather" : "backend";
    throw new ApiError(`Network request failed for ${url}`, source);
  }
}

function assertOpenWeatherKey() {
  if (!OPENWEATHER_API_KEY) {
    throw new ApiError("Missing VITE_OPENWEATHER_API_KEY in frontend/.env", "openweather");
  }
}

function assertApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new ApiError("Missing VITE_API_BASE_URL in frontend/.env", "backend");
  }
}

export async function fetchPollutants(lat: number, lng: number): Promise<PollutantData> {
  assertOpenWeatherKey();

  const url =
    `http://api.openweathermap.org/data/2.5/air_pollution` +
    `?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}`;

  const data = await requestJSON<OpenWeatherResponse>(url);
  const components = data.list?.[0]?.components;

  if (!components) {
    throw new ApiError("OpenWeather response missing pollutant components.", "openweather");
  }

  const pollutants: PollutantData = {
    pm2_5: Number(components.pm2_5 ?? 0),
    pm10: Number(components.pm10 ?? 0),
    co: Number(components.co ?? 0),
    no2: Number(components.no2 ?? 0),
    so2: Number(components.so2 ?? 0),
    o3: Number(components.o3 ?? 0),
    ...getTimeFeatures(),
  };

  return pollutants;
}

export async function fetchForecast(
  city: string,
  pollutants: PollutantData,
): Promise<ForecastResult> {
  assertApiBaseUrl();

  const payload = createPredictionPayload(city, pollutants);
  return requestJSON<ForecastResult>(`${API_BASE_URL}/predict/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchClassification(
  city: string,
  pollutants: PollutantData,
): Promise<ClassifyResult> {
  assertApiBaseUrl();

  const payload = createPredictionPayload(city, pollutants);
  return requestJSON<ClassifyResult>(`${API_BASE_URL}/predict/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchSHAP(city: string, pollutants: PollutantData): Promise<SHAPResult> {
  assertApiBaseUrl();

  const payload = createPredictionPayload(city, pollutants);
  return requestJSON<SHAPResult>(`${API_BASE_URL}/predict/explain/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchCityAQI(city: City): Promise<CityAQIData> {
  const pollutants = await fetchPollutants(city.lat, city.lng);
  const [forecast, classification] = await Promise.all([
    fetchForecast(city.id, pollutants),
    fetchClassification(city.id, pollutants),
  ]);

  return {
    city,
    pollutants,
    forecast,
    classification,
    current_aqi: computeAQI(pollutants),
  };
}
