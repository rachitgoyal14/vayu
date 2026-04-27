/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PollutantData } from "./types";

// CPCB (Central Pollution Control Board) 6-category AQI scale
// Good: 0–50 | Satisfactory: 51–100 | Moderate: 101–200
// Poor: 201–300 | Very Poor: 301–400 | Severe: 401–500
export type AQICategory =
  | "Good"
  | "Satisfactory"
  | "Moderate"
  | "Poor"
  | "Very Poor"
  | "Severe";

export type BackendAQICategory = AQICategory;

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
  if (aqi <= 50)  return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
};

export const getAQICategory = getCategory;

// Backend already uses CPCB labels — map straight through
export function mapBackendCategory(category: string): AQICategory {
  switch (category) {
    case "Good":        return "Good";
    case "Satisfactory":return "Satisfactory";
    case "Moderate":    return "Moderate";
    case "Poor":        return "Poor";
    case "Very Poor":   return "Very Poor";
    case "Severe":      return "Severe";
    // Legacy US-EPA labels that may still appear in old cache entries
    case "Unhealthy":   return "Very Poor";
    case "Hazardous":   return "Severe";
    default:            return "Moderate";
  }
}

export const getAQIColor = (category: AQICategory): string => {
  switch (category) {
    case "Good":        return "#00C853"; // vivid green
    case "Satisfactory":return "#8BC34A"; // yellow-green
    case "Moderate":    return "#FFC107"; // amber
    case "Poor":        return "#FF7043"; // deep orange
    case "Very Poor":   return "#E53935"; // red
    case "Severe":      return "#7B1FA2"; // deep purple
    default:            return "#94a3b8";
  }
};

export const getAQIGradient = (category: AQICategory): string => {
  switch (category) {
    case "Good":        return "from-green-950/20 via-green-900/10 to-transparent";
    case "Satisfactory":return "from-lime-950/20 via-lime-900/10 to-transparent";
    case "Moderate":    return "from-amber-950/20 via-amber-900/10 to-transparent";
    case "Poor":        return "from-orange-950/20 via-orange-900/10 to-transparent";
    case "Very Poor":   return "from-red-950/20 via-red-900/10 to-transparent";
    case "Severe":      return "from-purple-950/30 via-purple-950/20 to-transparent";
    default:            return "from-slate-900/20 to-transparent";
  }
};

type BreakpointTuple = [number, number, number, number];

const BREAKPOINTS: Record<"pm2_5" | "pm10" | "no2" | "so2" | "o3" | "co", BreakpointTuple[]> = {
  pm2_5: [[0, 30, 0, 50], [31, 60, 51, 100], [61, 90, 101, 200], [91, 120, 201, 300], [121, 250, 301, 400], [251, 500, 401, 500]],
  pm10:  [[0, 50, 0, 50], [51, 100, 51, 100], [101, 250, 101, 200], [251, 350, 201, 300], [351, 430, 301, 400], [431, 600, 401, 500]],
  no2:   [[0, 40, 0, 50], [41, 80, 51, 100], [81, 180, 101, 200], [181, 280, 201, 300], [281, 400, 301, 400], [401, 1000, 401, 500]],
  so2:   [[0, 40, 0, 50], [41, 80, 51, 100], [81, 380, 101, 200], [381, 800, 201, 300], [801, 1600, 301, 400], [1601, 2000, 401, 500]],
  o3:    [[0, 50, 0, 50], [51, 100, 51, 100], [101, 168, 101, 200], [169, 208, 201, 300], [209, 748, 301, 400], [749, 1000, 401, 500]],
  co:    [[0, 1, 0, 50], [1.1, 2, 51, 100], [2.1, 10, 101, 200], [10.1, 17, 201, 300], [17.1, 34, 301, 400], [34.1, 50, 401, 500]],
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
    getSubIndex(pollutants.pm10,  BREAKPOINTS.pm10),
    getSubIndex(pollutants.no2,   BREAKPOINTS.no2),
    getSubIndex(pollutants.so2,   BREAKPOINTS.so2),
    getSubIndex(pollutants.o3,    BREAKPOINTS.o3),
    getSubIndex(coMgM3,           BREAKPOINTS.co),
  ];

  return Math.max(...subIndices);
}