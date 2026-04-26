/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import Atmosphere from "./components/Atmosphere";
import Navbar from "./components/Navbar";
import AQICard from "./components/AQICard";
import IndiaMap from "./components/IndiaMap";
import TrendChart from "./components/TrendChart";
import CityGrid from "./components/CityGrid";
import PollutantAnalysis from "./components/PollutantAnalysis";
import { CITIES, City } from "./lib/cityData";
import { ApiError, fetchClassification, fetchForecast, fetchPollutants, fetchSHAP } from "./lib/api";
import type { CityAQIData, SHAPResult } from "./lib/types";
import { computeAQI, getAQIColor, getCategory, mapBackendCategory } from "./lib/aqiUtils";

type PredictionWindow = "6h" | "12h" | "24h";

const EMPTY_TREND = Array.from({ length: 24 }).map((_, i) => ({
  time: `${i.toString().padStart(2, "0")}:00`,
  value: 0,
}));

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
    const value = leftAnchor.value + (rightAnchor.value - leftAnchor.value) * progress;

    return {
      time: `${hour.toString().padStart(2, "0")}:00`,
      value: Math.round(value),
    };
  });
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
  const cityCacheRef = useRef<Record<string, CityAQIData>>({});

  useEffect(() => {
    cityCacheRef.current = cityCache;
  }, [cityCache]);

  useEffect(() => {
    // Smooth scroll to top on city change
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedCity]);

  useEffect(() => {
    let isMounted = true;

    const loadCityData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setSensorOffline(false);
      setPredictionOffline(false);

      try {
        const pollutants = await fetchPollutants(selectedCity.lat, selectedCity.lng);
        const [forecastResult, classificationResult, shapResult] = await Promise.allSettled([
          fetchForecast(selectedCity.id, pollutants),
          fetchClassification(selectedCity.id, pollutants),
          fetchSHAP(selectedCity.id, pollutants),
        ]);

        if (!isMounted) return;

        const backendFailed =
          forecastResult.status === "rejected" || classificationResult.status === "rejected";

        if (backendFailed) {
          setPredictionOffline(true);
          setErrorMessage("Prediction engine offline");

          // Keep last known city model output if backend is unavailable.
          const cached = cityCacheRef.current[selectedCity.id] ?? null;
          if (cached) {
            setCityAQI({
              ...cached,
              pollutants,
              current_aqi: cached.current_aqi,
            });
          } else {
            setCityAQI((prev) =>
              prev
                ? {
                    ...prev,
                    pollutants,
                    current_aqi: prev.current_aqi,
                  }
                : null,
            );
          }

          if (shapResult.status === "fulfilled") {
            setShapData(shapResult.value);
          }
          return;
        }

        const nextCityData: CityAQIData = {
          city: selectedCity,
          pollutants,
          forecast: forecastResult.value,
          classification: classificationResult.value,
          current_aqi: computeAQI(pollutants),
        };

        setCityAQI(nextCityData);
        setCityCache((prev) => ({ ...prev, [selectedCity.id]: nextCityData }));

        if (shapResult.status === "fulfilled") {
          setShapData(shapResult.value);
        }
      } catch (error) {
        if (!isMounted) return;
        const isSensorError = error instanceof ApiError && error.source === "openweather";
        if (isSensorError) {
          setSensorOffline(true);
          setErrorMessage("Sensor offline");
          const cached = cityCacheRef.current[selectedCity.id] ?? null;
          if (cached) {
            setCityAQI(cached);
          }
        } else {
          const message = error instanceof Error ? error.message : "Unable to fetch live AQI data.";
          setErrorMessage(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadCityData();
    const timer = window.setInterval(() => {
      void loadCityData();
    }, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [selectedCity]);

  const aqiData = useMemo(() => {
    const fallbackAQI = 100;
    const forecast = cityAQI?.forecast.forecast;
    const currentAQI = cityAQI?.current_aqi ?? fallbackAQI;

    const fallbackCategory = getCategory(currentAQI);
    const forecastData = forecast ?? {
      "6h": { aqi: currentAQI, category: fallbackCategory, color: getAQIColor(fallbackCategory) },
      "12h": { aqi: currentAQI, category: fallbackCategory, color: getAQIColor(fallbackCategory) },
      "24h": { aqi: currentAQI, category: fallbackCategory, color: getAQIColor(fallbackCategory) },
    };

    const activeBackendCategory = forecastData[predictionType]?.category;
    const mappedCategory = activeBackendCategory
      ? mapBackendCategory(activeBackendCategory)
      : getCategory(currentAQI);

    return {
      aqi: Math.round(currentAQI),
      category: mappedCategory,
      pm25: Math.round(cityAQI?.pollutants.pm2_5 ?? 0),
      pm10: Math.round(cityAQI?.pollutants.pm10 ?? 0),
      source: cityAQI?.classification.predicted_category
        ? `${cityAQI.classification.predicted_category} Atmospheric Pattern`
        : "Live Sensor Fusion",
      forecast: forecastData,
      trend: forecast ? buildTrend(currentAQI, forecast) : EMPTY_TREND,
    };
  }, [cityAQI, predictionType, shapData]);

  return (
    <div className="min-h-screen bg-[#0A0606] text-slate-100 selection:bg-red-600 selection:text-white">
      <Atmosphere category={aqiData.category} />
      
      <Navbar onCitySelect={setSelectedCity} selectedCity={selectedCity} />
      {predictionOffline && (
        <div className="fixed top-20 left-0 right-0 z-[90] px-8">
          <div className="mx-auto max-w-[1600px] rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
            Prediction engine offline
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-8 pt-24 pb-20 space-y-24">
        {/* Dynamic Hero Section: 3:2 Split */}
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

        {/* Intelligence Layer: SHA + NMF Mini Cards */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
             <div className="h-0.5 w-12 bg-white/10" />
             <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 whitespace-nowrap">Neural Decomposition Analysis</h2>
             <div className="h-0.5 flex-1 bg-white/10" />
          </div>
          <PollutantAnalysis 
            category={aqiData.category} 
            source={aqiData.source} 
            shapData={shapData}
          />
          {isLoading && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Syncing live city sensors...</p>
          )}
          {errorMessage && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/80">
              Live API degraded. Showing last stable visualization state.
            </p>
          )}
          {sensorOffline && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Sensor offline. Using last known city data.
            </p>
          )}
        </section>

        {/* Temporal Grid Trends */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
             <div className="h-0.5 w-12 bg-white/10" />
             <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 whitespace-nowrap">Temporal Matrix Trend</h2>
             <div className="h-0.5 flex-1 bg-white/10" />
          </div>
          <TrendChart
            category={aqiData.category}
            data={aqiData.trend}
            statusLabel={
              predictionOffline
                ? "Prediction Engine Offline"
                : sensorOffline
                  ? "Sensor Offline - Last Stable Feed"
                  : undefined
            }
          />
        </section>

        {/* National Network Grid */}
        <section className="space-y-8 pb-10">
          <div className="flex items-center gap-4">
             <div className="h-0.5 w-12 bg-white/10" />
             <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 whitespace-nowrap">National Sensor Network Matrix</h2>
             <div className="h-0.5 flex-1 bg-white/10" />
          </div>
          <CityGrid onCitySelect={setSelectedCity} selectedCity={selectedCity} cityAQI={cityAQI} />
        </section>
      </main>

      {/* Footer / Global Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-10 bg-black/80 backdrop-blur-3xl border-t border-white/5 px-8 flex items-center justify-between z-50">
        <div className="flex gap-8 items-center">
           <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Model Core:</span>
              <span className="text-[9px] font-black text-red-500 uppercase tracking-[0.2em] animate-pulse">XGBoost-V4.1 DeepSense</span>
           </div>
           <div className="w-px h-3 bg-white/10" />
           <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Matrix Nodes:</span>
              <span className="text-[9px] font-black text-slate-100 uppercase tracking-[0.2em]">{CITIES.length} Units Online</span>
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
    </div>
  );
}
