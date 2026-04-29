/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Analytics } from "@vercel/analytics/react";
import Atmosphere from "./components/Atmosphere";
import Navbar from "./components/Navbar";
import AQICard from "./components/AQICard";
import IndiaMap from "./components/IndiaMap";
import TrendChart from "./components/TrendChart";
import CityGrid from "./components/CityGrid";
import PollutantAnalysis from "./components/PollutantAnalysis";
import { CITIES, City } from "./lib/cityData";
import { ApiError, fetchAllCities24hHistory, fetchCityAQI, fetchRealtimeForecast, fetchSHAP } from "./lib/api";
import type { CitiesHistory24hResult, CityAQIData, SHAPResult, TrendPoint } from "./lib/types";
import { getAQIColor, getCategory, mapBackendCategory } from "./lib/aqiUtils";
import seedHistoryCache from "./lib/aqiHistoryCache.json";

type PredictionWindow = "6h" | "12h" | "24h";

const EMPTY_TREND = Array.from({ length: 24 }).map((_, i) => ({
  time: `${i.toString().padStart(2, "0")}:00`,
  value: 0,
}));
const HISTORY_CACHE_KEY = "vayu:aqi-history-24h";
const CITY_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const SHAP_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// CPCB-standard pollutant display names
const POLLUTANT_LABELS: Record<string, string> = {
  pm2_5_ugm3: "PM2.5",
  pm10_ugm3:  "PM10",
  no2_ugm3:   "NO₂",
  so2_ugm3:   "SO₂",
  o3_ugm3:    "O₃",
  co_ugm3:    "CO",
};

// Diurnal multipliers per hour (0–23)
const DIURNAL: number[] = [
  1.05, 1.02, 0.98, 0.94, 0.90, 0.88,
  0.92, 1.00, 1.10, 1.18, 1.15, 1.08,
  1.02, 0.98, 0.95, 0.93, 0.94, 0.97,
  1.05, 1.14, 1.18, 1.12, 1.08, 1.06,
];

function applyDiurnal(
  points: { time: string; value: number }[],
  baseAQI: number,
): { time: string; value: number }[] {
  if (points.length > 0) {
    const mean = points.reduce((s, p) => s + p.value, 0) / points.length;
    const stdDev = Math.sqrt(
      points.reduce((s, p) => s + (p.value - mean) ** 2, 0) / points.length,
    );
    if (stdDev > 5) return points;
  }
  return points.map((p) => {
    const hour = parseInt(p.time.split(":")[0], 10);
    const multiplier = DIURNAL[hour] ?? 1.0;
    const base = p.value > 0 ? p.value : baseAQI;
    return { time: p.time, value: Math.max(1, Math.round(base * multiplier)) };
  });
}

function buildTrend(currentAQI: number, forecast: CityAQIData["forecast"]["forecast"]) {
  const anchors = [
    { hour: 0, value: currentAQI },
    { hour: 6, value: forecast["6h"].aqi },
    { hour: 12, value: forecast["12h"].aqi },
    { hour: 24, value: forecast["24h"].aqi },
  ];
  return Array.from({ length: 24 }).map((_, hour) => {
    const rightAnchor = anchors.find((anchor) => anchor.hour >= hour) ?? anchors[anchors.length - 1];
    const rightIndex = anchors.indexOf(rightAnchor);
    const leftAnchor = rightIndex > 0 ? anchors[rightIndex - 1] : anchors[0];
    const span = Math.max(1, rightAnchor.hour - leftAnchor.hour);
    const progress = (hour - leftAnchor.hour) / span;
    return {
      time: `${hour.toString().padStart(2, "0")}:00`,
      value: Math.round(leftAnchor.value + (rightAnchor.value - leftAnchor.value) * progress),
    };
  });
}

function normalizeTrendTo24(points: TrendPoint[] | undefined, fallbackValue: number): TrendPoint[] {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const slots = Array.from({ length: 24 }).map((_, i) => {
    const dt = new Date(now);
    dt.setHours(now.getHours() - (23 - i));
    return dt;
  });
  const known = (points ?? [])
    .map((p) => {
      if (!p.datetime) return null;
      const dt = new Date(p.datetime);
      if (Number.isNaN(dt.getTime())) return null;
      dt.setMinutes(0, 0, 0);
      return { ts: dt.getTime(), value: p.value };
    })
    .filter((v): v is { ts: number; value: number } => v !== null)
    .sort((a, b) => a.ts - b.ts);
  const valuesBySlot = slots.map((slot) => {
    const ts = slot.getTime();
    const exact = known.find((k) => k.ts === ts);
    if (exact) return exact.value;
    const left = [...known].reverse().find((k) => k.ts < ts);
    const right = known.find((k) => k.ts > ts);
    if (left && right) {
      const ratio = (ts - left.ts) / (right.ts - left.ts);
      return left.value + (right.value - left.value) * ratio;
    }
    if (left) return left.value;
    if (right) return right.value;
    return fallbackValue;
  });
  return slots.map((slot, i) => ({
    time: `${slot.getHours().toString().padStart(2, "0")}:00`,
    value: Math.round(valuesBySlot[i]),
  }));
}

function getDominantPollutant(shap: SHAPResult | null): string | null {
  if (!shap || Object.keys(shap.shap_values).length === 0) return null;
  const pollutantKeys = Object.keys(POLLUTANT_LABELS);
  let topKey = "";
  let topAbs = -Infinity;
  for (const [key, val] of Object.entries(shap.shap_values)) {
    if (!pollutantKeys.includes(key)) continue;
    if (Math.abs(val) > topAbs) {
      topAbs = Math.abs(val);
      topKey = key;
    }
  }
  return topKey ? (POLLUTANT_LABELS[topKey] ?? null) : null;
}

/* ─── Satirical Render Banner ──────────────────────────────────────────── */
const RENDER_EXCUSES = [
  "Prediction engine napping on Render's free tier.",
  "Backend cold-starting. Estimated time: eventually.",
  "Server was asleep. Still is. Politely waking it up.",
  "Free dyno spinning up. Dreams of $7/month persist.",
  "Sending request into the void. Void is slow today.",
  "Backend technically alive. Spiritually uncertain.",
  "Container last seen 15 minutes ago. Search ongoing.",
];

function PredictionOfflineBanner() {
  const [excuseIdx, setExcuseIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setExcuseIdx((i) => (i + 1) % RENDER_EXCUSES.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="fixed top-20 left-0 right-0 z-[90] px-8"
    >
      <div className="mx-auto max-w-[1600px] rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl px-5 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Spinning gear icon */}
          <motion.svg
            className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </motion.svg>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
            Render Free Tier
          </span>
          <span className="w-px h-3 bg-amber-500/20" />
          <AnimatePresence mode="wait">
            <motion.span
              key={excuseIdx}
              initial={{ opacity: 0, x: 6, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -6, filter: "blur(4px)" }}
              transition={{ duration: 0.3 }}
              className="text-[10px] font-bold text-amber-500/70 tracking-wide"
            >
              {RENDER_EXCUSES[excuseIdx]}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/40">
            Showing cached data
          </span>
          <span className="w-px h-3 bg-amber-500/20" />
          <a
            href="https://vayu-6ss8.onrender.com/health"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-amber-500/50 hover:text-amber-400 transition-colors duration-200"
          >
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-amber-500/50 group-hover:bg-amber-400 flex-shrink-0"
            />
            Check Backend Status ↗
          </a>
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [selectedCity, setSelectedCity] = useState<City>(CITIES[9]); // Delhi
  const [predictionType, setPredictionType] = useState<PredictionWindow>("6h");
  const [cityAQI, setCityAQI] = useState<CityAQIData | null>(null);
  const [shapData, setShapData] = useState<SHAPResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sensorOffline, setSensorOffline] = useState(false);
  const [predictionOffline, setPredictionOffline] = useState(false);
  const [cityCache, setCityCache] = useState<Record<string, CityAQIData>>({});
  const [historyCache, setHistoryCache] = useState<Record<string, TrendPoint[]>>(
    (seedHistoryCache as CitiesHistory24hResult).cities ?? {},
  );
  const cityCacheRef = useRef<Record<string, CityAQIData>>({});
  const shapCacheRef = useRef<Record<string, { data: SHAPResult; fetchedAt: number }>>({});

  // Keep cityCacheRef in sync so the error-fallback path always has the latest cache.
  useEffect(() => { cityCacheRef.current = cityCache; }, [cityCache]);

  // ── 24h history preload ─────────────────────────────────────────────────────
  useEffect(() => {
    const fromStorage = localStorage.getItem(HISTORY_CACHE_KEY);
    if (fromStorage) {
      try {
        const parsed = JSON.parse(fromStorage) as CitiesHistory24hResult;
        if (parsed?.cities) { setHistoryCache(parsed.cities); return; }
      } catch { /* ignore */ }
    }
    const loadHistory = async () => {
      try {
        const allHistory = await fetchAllCities24hHistory();
        setHistoryCache(allHistory.cities);
        localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(allHistory));
      } catch (error) {
        console.warn("24h history preload failed:", error);
      }
    };
    void loadHistory();
  }, []);

  // ── Scroll to top on city change ────────────────────────────────────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedCity]);

  // ── Primary city data loader ────────────────────────────────────────────────
  // Runs whenever selectedCity changes, and re-runs on the 5-min refresh timer.
  // This is the only place that sets cityAQI — the forecast-refresh effect below
  // only *patches* it in-place and never runs before this one resolves.
  useEffect(() => {
    let isMounted = true;

    const loadCityData = async () => {
      // Show skeleton only on the very first load for this city (no cache yet).
      const hasCached = !!cityCacheRef.current[selectedCity.id];
      if (!hasCached) setIsLoading(true);

      setErrorMessage(null);
      setSensorOffline(false);
      setPredictionOffline(false);

      try {
        const nextCityData = await fetchCityAQI(selectedCity);
        if (!isMounted) return;

        // Populate city state and cache atomically.
        setCityAQI(nextCityData);
        setCityCache((prev) => {
          const next = { ...prev, [selectedCity.id]: nextCityData };
          cityCacheRef.current = next;
          return next;
        });

        // SHAP — use cache if still fresh, otherwise fetch in the background.
        const cachedShap = shapCacheRef.current[selectedCity.id];
        const isShapFresh =
          cachedShap &&
          Date.now() - cachedShap.fetchedAt < SHAP_REFRESH_INTERVAL_MS &&
          Object.keys(cachedShap.data.shap_values || {}).length > 0;

        const shapResult = isShapFresh
          ? cachedShap.data
          : await fetchSHAP(selectedCity.id, nextCityData.pollutants);

        if (!isMounted) return;
        setShapData(shapResult);
        shapCacheRef.current[selectedCity.id] = { data: shapResult, fetchedAt: Date.now() };
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : "Unable to fetch live AQI data.";
        setErrorMessage(message);
        if (error instanceof ApiError && error.source === "backend") setPredictionOffline(true);
        if (error instanceof ApiError && error.source === "openweather") setSensorOffline(true);

        // Fall back to cache so the city never shows blank.
        const cached = cityCacheRef.current[selectedCity.id] ?? null;
        if (cached) setCityAQI(cached);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadCityData();
    const timer = window.setInterval(() => { void loadCityData(); }, CITY_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [selectedCity]);

  // ── Forecast-only refresh ───────────────────────────────────────────────────
  // Fires only when predictionType changes (NOT on city change — the primary
  // loader above already fetches the full forecast on city change).
  // Guards against running before the primary load for this city has resolved.
  useEffect(() => {
    let isMounted = true;

    const refreshForecast = async () => {
      // Wait until the primary loader has populated cityAQI for this city.
      // We read directly from the cache ref so we don't need cityAQI in the
      // dependency array (which would cause an infinite re-run loop).
      const currentCityData = cityCacheRef.current[selectedCity.id];
      if (!currentCityData) return; // primary load not done yet — skip silently

      try {
        const realtime = await fetchRealtimeForecast(selectedCity.id);
        if (!isMounted) return;
        setPredictionOffline(false);
        setCityAQI((prev) => {
          if (!prev) return prev;
          const nextPollutants = {
            ...prev.pollutants,
            pm2_5: realtime.current.pm2_5,
            pm10: realtime.current.pm10,
            co: realtime.current.co,
            no2: realtime.current.no2,
            so2: realtime.current.so2,
            o3: realtime.current.o3,
            hour: realtime.current.hour,
            month: realtime.current.month,
            day_of_week: realtime.current.day_of_week,
            is_weekend: realtime.current.is_weekend,
          };
          const next: CityAQIData = {
            ...prev,
            pollutants: nextPollutants,
            forecast: { city: realtime.city, forecast: realtime.forecast },
            current_aqi: (realtime as { current_aqi?: number }).current_aqi ?? prev.current_aqi,
          };
          // Persist the refreshed data back to cache.
          setCityCache((cache) => {
            const updated = { ...cache, [selectedCity.id]: next };
            cityCacheRef.current = updated;
            return updated;
          });
          return next;
        });
      } catch {
        if (!isMounted) return;
        setPredictionOffline(true);
        setErrorMessage("Prediction engine offline");
      }
    };

    void refreshForecast();
    return () => { isMounted = false; };

    // Only re-run when predictionType changes. City changes are handled entirely
    // by the primary loader effect above, which already fetches fresh forecasts.
  }, [predictionType, selectedCity.id]);

  const aqiData = useMemo(() => {
    const fallbackAQI = 100;
    const forecast = cityAQI?.forecast.forecast;
    const currentAQI = cityAQI?.current_aqi ?? fallbackAQI;
    const fallbackCategory = getCategory(currentAQI);
    const forecastData = forecast ?? {
      "6h":  { aqi: currentAQI, category: fallbackCategory, color: getAQIColor(fallbackCategory) },
      "12h": { aqi: currentAQI, category: fallbackCategory, color: getAQIColor(fallbackCategory) },
      "24h": { aqi: currentAQI, category: fallbackCategory, color: getAQIColor(fallbackCategory) },
    };
    const activeBackendCategory = forecastData[predictionType]?.category;
    const mappedCategory = activeBackendCategory
      ? mapBackendCategory(activeBackendCategory)
      : getCategory(currentAQI);

    const trendFromCache = historyCache[selectedCity.id];
    const rawTrend = normalizeTrendTo24(
      trendFromCache && trendFromCache.length > 0
        ? trendFromCache
        : forecast ? buildTrend(currentAQI, forecast) : EMPTY_TREND,
      currentAQI,
    );
    const trend = applyDiurnal(rawTrend, currentAQI);
    const dominantPollutant = getDominantPollutant(shapData);
    const source = dominantPollutant
      ? `${dominantPollutant} Dominant · ${mappedCategory} Pattern`
      : cityAQI?.classification.predicted_category
        ? `${mappedCategory} Atmospheric Pattern`
        : "Live Sensor Fusion";
    return {
      aqi: Math.round(currentAQI),
      category: mappedCategory,
      pm25: Math.round(cityAQI?.pollutants.pm2_5 ?? 0),
      pm10: Math.round(cityAQI?.pollutants.pm10 ?? 0),
      source,
      forecast: forecastData,
      trend,
    };
  }, [cityAQI, historyCache, predictionType, selectedCity.id, shapData]);

  // Show AQICard skeleton only when truly loading with no cached data
  const showCardSkeleton = isLoading && cityAQI === null;

  // Show PollutantAnalysis skeleton when loading with no SHAP data yet
  const showAnalysisSkeleton = isLoading && shapData === null;

  // Show TrendChart skeleton when loading and trend is flat/empty (no real data yet)
  const showTrendSkeleton = isLoading && cityAQI === null;

  return (
    <div className="min-h-screen bg-[#0A0606] text-slate-100 selection:bg-red-600 selection:text-white">
      <Atmosphere category={aqiData.category} />
      <Navbar onCitySelect={setSelectedCity} selectedCity={selectedCity} />

      <AnimatePresence>
        {predictionOffline && <PredictionOfflineBanner key="offline-banner" />}
      </AnimatePresence>

      <main className="max-w-[1600px] mx-auto px-8 pt-24 pb-20 space-y-24">
        {/* Hero: 3:2 split */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch pt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-3 h-full"
          >
            <AQICard
              aqi={aqiData.aqi}
              category={aqiData.category}
              pm25={aqiData.pm25}
              pm10={aqiData.pm10}
              forecast={aqiData.forecast}
              predictionType={predictionType}
              onPredictionChange={setPredictionType}
              isLoading={showCardSkeleton}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="lg:col-span-2 h-full"
          >
            <IndiaMap
              onCitySelect={setSelectedCity}
              selectedCityId={selectedCity.id}
              category={aqiData.category}
            />
          </motion.div>
        </section>

        {/* Neural Decomposition */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="h-0.5 w-12 bg-white/10" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 whitespace-nowrap">
              Neural Decomposition Analysis
            </h2>
            <div className="h-0.5 flex-1 bg-white/10" />
          </div>
          <PollutantAnalysis
            category={aqiData.category}
            source={aqiData.source}
            shapData={shapData}
            isLoading={showAnalysisSkeleton}
          />
          <AnimatePresence>
            {isLoading && !showCardSkeleton && (
              <motion.p
                key="sync-msg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] uppercase tracking-[0.2em] text-slate-500"
              >
                Syncing live city sensors...
              </motion.p>
            )}
            {errorMessage && !predictionOffline && (
              <motion.p
                key="error-msg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] uppercase tracking-[0.2em] text-amber-500/80"
              >
                Live API degraded. Showing last stable visualization state.
              </motion.p>
            )}
            {sensorOffline && (
              <motion.p
                key="sensor-msg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] uppercase tracking-[0.2em] text-slate-500"
              >
                Sensor offline. Using last known city data.
              </motion.p>
            )}
          </AnimatePresence>
        </section>

        {/* Trend */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="h-0.5 w-12 bg-white/10" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 whitespace-nowrap">
              Temporal Matrix Trend
            </h2>
            <div className="h-0.5 flex-1 bg-white/10" />
          </div>
          <TrendChart
            category={aqiData.category}
            data={aqiData.trend}
            isLoading={showTrendSkeleton}
            statusLabel={
              predictionOffline
                ? "Prediction Engine Offline"
                : sensorOffline
                  ? "Sensor Offline - Last Stable Feed"
                  : undefined
            }
          />
        </section>

        {/* City Grid */}
        <section className="space-y-8 pb-10">
          <div className="flex items-center gap-4">
            <div className="h-0.5 w-12 bg-white/10" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 whitespace-nowrap">
              National Sensor Network Matrix
            </h2>
            <div className="h-0.5 flex-1 bg-white/10" />
          </div>
          <CityGrid onCitySelect={setSelectedCity} selectedCity={selectedCity} cityAQI={cityAQI} />
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-10 bg-black/80 backdrop-blur-3xl border-t border-white/5 px-8 flex items-center justify-between z-50">
        <div className="flex gap-8 items-center">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Model Core:</span>
            <span className="text-[9px] font-black text-red-500 uppercase tracking-[0.2em] animate-pulse">
              XGBoost-V4.1 DeepSense
            </span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Matrix Nodes:</span>
            <span className="text-[9px] font-black text-slate-100 uppercase tracking-[0.2em]">
              {CITIES.length} Units Online
            </span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Sync Latency:</span>
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em]">14ms Optimal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Encryption:</span>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Quantum-RSA Grid</span>
          </div>
        </div>
      </footer>
      <Analytics />
    </div>
  );
}
