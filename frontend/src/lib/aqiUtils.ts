/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PollutantData } from "./types";

export type AQICategory = "Good" | "Moderate" | "Poor" | "Unhealthy" | "Severe" | "Hazardous";
export type BackendAQICategory = "Good" | "Moderate" | "Poor" | "Very Poor";

export interface AQIData {
  aqi: number;
  category: AQICategory;
  pm25: number;
  pm10: number;
  dominantPollutant: string;
  source: string;
  forecast: {
    "6h": number;
    "12h": number;
    "24h": number;
  };
  trend: { time: string; value: number }[];
}

export const getCategory = (aqi: number): AQICategory => {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 200) return "Poor";
  if (aqi <= 300) return "Unhealthy";
  if (aqi <= 400) return "Severe";
  return "Hazardous";
};

export const getAQICategory = getCategory;

export function mapBackendCategory(category: string): AQICategory {
  switch (category) {
    case "Good":
      return "Good";
    case "Moderate":
      return "Moderate";
    case "Poor":
      return "Poor";
    case "Very Poor":
      return "Unhealthy";
    default:
      return "Moderate";
  }
}

export const getAQIColor = (category: AQICategory): string => {
  switch (category) {
    case "Good": return "#10b981"; // Emerald 500
    case "Moderate": return "#f59e0b"; // Amber 500
    case "Poor": return "#f97316"; // Orange 500
    case "Unhealthy": return "#ef4444"; // Red 500
    case "Severe": return "#8b5cf6"; // Violet 500
    case "Hazardous": return "#7f1d1d"; // Dark Red
    default: return "#94a3b8";
  }
};

export const getAQIGradient = (category: AQICategory): string => {
  switch (category) {
    case "Good": return "from-emerald-950/20 via-emerald-900/10 to-transparent";
    case "Moderate": return "from-amber-950/20 via-amber-900/10 to-transparent";
    case "Poor": return "from-orange-950/20 via-orange-900/10 to-transparent";
    case "Unhealthy": return "from-red-950/20 via-red-900/10 to-transparent";
    case "Severe": return "from-violet-950/20 via-violet-900/10 to-transparent";
    case "Hazardous": return "from-rose-950/30 via-rose-950/20 to-transparent";
    default: return "from-slate-900/20 to-transparent";
  }
};

type BreakpointTuple = [number, number, number, number];

const BREAKPOINTS: Record<"pm2_5" | "pm10" | "no2" | "so2" | "o3" | "co", BreakpointTuple[]> = {
  pm2_5: [[0, 30, 0, 50], [31, 60, 51, 100], [61, 90, 101, 200], [91, 120, 201, 300], [121, 250, 301, 400], [251, 500, 401, 500]],
  pm10: [[0, 50, 0, 50], [51, 100, 51, 100], [101, 250, 101, 200], [251, 350, 201, 300], [351, 430, 301, 400], [431, 600, 401, 500]],
  no2: [[0, 40, 0, 50], [41, 80, 51, 100], [81, 180, 101, 200], [181, 280, 201, 300], [281, 400, 301, 400], [401, 1000, 401, 500]],
  so2: [[0, 40, 0, 50], [41, 80, 51, 100], [81, 380, 101, 200], [381, 800, 201, 300], [801, 1600, 301, 400], [1601, 2000, 401, 500]],
  o3: [[0, 50, 0, 50], [51, 100, 51, 100], [101, 168, 101, 200], [169, 208, 201, 300], [209, 748, 301, 400], [749, 1000, 401, 500]],
  co: [[0, 1, 0, 50], [1.1, 2, 51, 100], [2.1, 10, 101, 200], [10.1, 17, 201, 300], [17.1, 34, 301, 400], [34.1, 50, 401, 500]],
};

function getSubIndex(concentration: number, breakpoints: BreakpointTuple[]): number {
  for (const [bpLow, bpHigh, iLow, iHigh] of breakpoints) {
    if (concentration >= bpLow && concentration <= bpHigh) {
      return Math.round(((iHigh - iLow) / (bpHigh - bpLow)) * (concentration - bpLow) + iLow);
    }
  }
  return 500;
}

export function computeAQI(pollutants: PollutantData): number {
  const coMgM3 = pollutants.co / 1000;

  const subIndices = [
    getSubIndex(pollutants.pm2_5, BREAKPOINTS.pm2_5),
    getSubIndex(pollutants.pm10, BREAKPOINTS.pm10),
    getSubIndex(pollutants.no2, BREAKPOINTS.no2),
    getSubIndex(pollutants.so2, BREAKPOINTS.so2),
    getSubIndex(pollutants.o3, BREAKPOINTS.o3),
    getSubIndex(coMgM3, BREAKPOINTS.co),
  ];

  return Math.max(...subIndices);
}
