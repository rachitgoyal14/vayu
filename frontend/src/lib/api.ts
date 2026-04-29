import type { City } from "./cityData";
import type {
  CitiesHistory24hResult,
  CityAQIData,
  ForecastResult,
  PollutantData,
  SHAPResult,
} from "./types";
import { computeAQI, getCategory } from "./aqiUtils";

type RawPollutants = Omit<PollutantData, "hour" | "month" | "day_of_week" | "is_weekend">;

interface PredictionPayload extends PollutantData {
  city: string;
}

interface OpenWeatherResponse {
  list?: Array<{
    components?: Partial<RawPollutants>;
  }>;
}

interface RealtimeForecastResponse {
  city: string;
  datetime?: string;
  current_aqi?: number;
  current: {
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
  };
  forecast: ForecastResult["forecast"];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

// ─── In-flight deduplication ──────────────────────────────────────────────────
// If two callers request the same city simultaneously (e.g. CityGrid + AQICard
// both mounting at the same time), only one HTTP round-trip is made. Both
// callers receive the exact same Promise, so they resolve with identical data.
const inFlight = new Map<string, Promise<unknown>>();

function deduped<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inFlight.has(key)) return inFlight.get(key) as Promise<T>;
  const p = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

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
  console.log("OWM:", data);
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
  console.log("Sending payload:", payload);
  return requestJSON<ForecastResult>(`${API_BASE_URL}/predict/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchSHAP(city: string, pollutants: PollutantData): Promise<SHAPResult> {
  assertApiBaseUrl();

  const payload = createPredictionPayload(city, pollutants);
  console.log("Sending payload:", payload);
  try {
    return await requestJSON<SHAPResult>(`${API_BASE_URL}/predict/explain/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Keep UI stable if explain endpoint is temporarily unavailable.
    if (error instanceof ApiError && error.source === "backend") {
      console.warn("SHAP endpoint unavailable; continuing without explanation.");
      return { shap_values: {} };
    }
    throw error;
  }
}

export async function fetchCityAQI(city: City): Promise<CityAQIData> {
  assertApiBaseUrl();

  // Deduplicate: if this city is already being fetched, reuse the same Promise.
  return deduped(`cityAQI:${city.id}`, async () => {
    const realtime = await requestJSON<RealtimeForecastResponse>(
      `${API_BASE_URL}/predict/forecast/realtime`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: city.id }),
      },
    );

    const pollutants: PollutantData = {
      pm2_5: Number(realtime.current.pm2_5 ?? 0),
      pm10: Number(realtime.current.pm10 ?? 0),
      co: Number(realtime.current.co ?? 0),
      no2: Number(realtime.current.no2 ?? 0),
      so2: Number(realtime.current.so2 ?? 0),
      o3: Number(realtime.current.o3 ?? 0),
      hour: Number(realtime.current.hour ?? getTimeFeatures().hour),
      month: Number(realtime.current.month ?? getTimeFeatures().month),
      day_of_week: Number(realtime.current.day_of_week ?? getTimeFeatures().day_of_week),
      is_weekend: Number(realtime.current.is_weekend ?? getTimeFeatures().is_weekend) as 0 | 1,
    };

    const current_aqi = realtime.current_aqi ?? computeAQI(pollutants);

    // Derive category purely from the CPCB AQI number — single source of truth.
    // The /predict/classify endpoint is intentionally not called here; its ML
    // output can diverge from CPCB thresholds and cause AQICard vs CityGrid
    // inconsistencies. getCategory() applies the same CPCB breakpoints used
    // everywhere else in the frontend.
    const category = getCategory(current_aqi);
    const classification = {
      city: city.id,
      predicted_category: category,
      probabilities: { [category]: 1 },
    };

    return {
      city,
      pollutants,
      forecast: {
        city: realtime.city,
        forecast: realtime.forecast,
      },
      classification,
      current_aqi,
    };
  });
}

export async function fetchRealtimeForecast(city: string): Promise<RealtimeForecastResponse> {
  assertApiBaseUrl();
  return requestJSON<RealtimeForecastResponse>(`${API_BASE_URL}/predict/forecast/realtime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city: city.toLowerCase() }),
  });
}

export async function fetchAllCities24hHistory(): Promise<CitiesHistory24hResult> {
  assertApiBaseUrl();
  return requestJSON<CitiesHistory24hResult>(`${API_BASE_URL}/history/24h/all`);
}