/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { CITIES, City } from "../lib/cityData";
import { getAQIColor, getCategory } from "../lib/aqiUtils";
import type { CityAQIData } from "../lib/types";
import { fetchCityAQI } from "../lib/api";

interface CityGridProps {
  onCitySelect: (city: City) => void;
  selectedCity: City;
  cityAQI: CityAQIData | null;
}

interface CityCardState {
  isLoading: boolean;
  hasError: boolean;
  aqi: number;
  category: ReturnType<typeof getCategory>;
  pm25: number;
  pm10: number;
}

export default function CityGrid({ onCitySelect, selectedCity, cityAQI }: CityGridProps) {
  const [cityStates, setCityStates] = useState<Record<string, CityCardState>>({});

  const mainCityNames = useMemo(
    () => [
      "Delhi",
      "Mumbai",
      "Bengaluru",
      "Kolkata",
      "Chennai",
      "Hyderabad",
      "Ahmedabad",
      "Chandigarh",
      "Lucknow",
      "Jaipur",
    ],
    [],
  );
  const mainCities = useMemo(
    () => CITIES.filter((c) => mainCityNames.includes(c.name)),
    [mainCityNames],
  );

  useEffect(() => {
    let isMounted = true;
    const loadingState: Record<string, CityCardState> = {};
    mainCities.forEach((city) => {
      loadingState[city.id] = {
        isLoading: true,
        hasError: false,
        aqi: 0,
        category: "Moderate",
        pm25: 0,
        pm10: 0,
      };
    });
    setCityStates(loadingState);

    const loadCities = async () => {
      const responses = await Promise.all(
        mainCities.map(async (city) => {
          try {
            const data = await fetchCityAQI(city);
            const aqi = Math.round(data.current_aqi);
            return {
              cityId: city.id,
              state: {
                isLoading: false,
                hasError: false,
                aqi,
                // Derive category from the CPCB AQI number — same function
                // used by AQICard — so both components always agree.
                category: getCategory(aqi),
                pm25: Math.round(data.pollutants.pm2_5),
                pm10: Math.round(data.pollutants.pm10),
              } satisfies CityCardState,
            };
          } catch (error) {
            console.error(`CityGrid fetch failed for ${city.id}:`, error);
            return {
              cityId: city.id,
              state: {
                isLoading: false,
                hasError: true,
                aqi: -1,
                category: "Moderate" as const,
                pm25: -1,
                pm10: -1,
              } satisfies CityCardState,
            };
          }
        }),
      );

      if (!isMounted) return;

      const nextState = responses.reduce<Record<string, CityCardState>>((acc, item) => {
        acc[item.cityId] = item.state;
        return acc;
      }, {});

      setCityStates(nextState);
    };

    void loadCities();

    return () => {
      isMounted = false;
    };
  }, [mainCities]);

  useEffect(() => {
    if (!cityAQI) return;
    const aqi = Math.round(cityAQI.current_aqi);
    setCityStates((prev) => ({
      ...prev,
      [selectedCity.id]: {
        isLoading: false,
        hasError: false,
        aqi,
        // Same CPCB derivation — never reads from classification response.
        category: getCategory(aqi),
        pm25: Math.round(cityAQI.pollutants.pm2_5),
        pm10: Math.round(cityAQI.pollutants.pm10),
      },
    }));
  }, [cityAQI, selectedCity.id]);

  const isGridLoading = mainCities.some((city) => cityStates[city.id]?.isLoading);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-3xl font-light tracking-tight uppercase">Metropolitan <span className="font-bold">Grid</span></h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1 italic">High Density Station Matrix</p>
        </div>
        <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          Primary Nodes: {mainCities.length}
        </div>
      </div>
      {isGridLoading && (
        <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full w-1/3 bg-red-600/60"
            animate={{ x: ["-40%", "240%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {mainCities.map((city, idx) => {
          const stats = cityStates[city.id] ?? {
            isLoading: true,
            hasError: false,
            aqi: 0,
            category: "Moderate" as const,
            pm25: 0,
            pm10: 0,
          };
          const color = getAQIColor(stats.category);
          
          return (
            <motion.div
              key={city.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.02 }}
              onClick={() => onCitySelect(city)}
              className="group cursor-pointer relative p-6 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.05] transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="text-white font-medium text-lg leading-tight capitalize">{city.name}</h4>
                  <p className="text-slate-500 text-[10px] uppercase font-black mt-1">Grid Area {idx + 100}</p>
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                   <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                   </svg>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  {stats.isLoading ? (
                    <div className="h-9 w-20 rounded-lg bg-white/10 animate-pulse" />
                  ) : stats.hasError ? (
                    <span className="text-lg font-black tracking-tighter text-amber-500/80">OFF</span>
                  ) : (
                    <span
                      className="text-3xl font-black tracking-tighter tabular-nums"
                      style={{ color, textShadow: `0 0 10px ${color}44` }}
                    >
                      {stats.aqi}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    {stats.isLoading ? (
                      <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
                    ) : stats.hasError ? (
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Sensor Offline</span>
                    ) : (
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                        {stats.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex -space-x-2">
                   {[1,2,3].map(i => (
                     <div key={i} className="w-6 h-6 rounded-full border-2 border-[#0A0606] bg-slate-800 flex items-center justify-center text-[8px] text-white/40">
                        {String.fromCharCode(64 + i)}
                     </div>
                   ))}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex gap-4">
                 <div className="flex flex-col">
                    <span className="text-slate-500 text-[8px] font-bold uppercase">PM2.5</span>
                    {stats.isLoading ? (
                      <div className="h-3 w-10 rounded bg-white/10 animate-pulse mt-1" />
                    ) : stats.hasError ? (
                      <span className="text-slate-300 text-[10px] font-bold tabular-nums">--</span>
                    ) : (
                      <span className="text-slate-300 text-[10px] font-bold tabular-nums">{stats.pm25}</span>
                    )}
                 </div>
                 <div className="flex flex-col">
                    <span className="text-slate-500 text-[8px] font-bold uppercase">PM10</span>
                    {stats.isLoading ? (
                      <div className="h-3 w-10 rounded bg-white/10 animate-pulse mt-1" />
                    ) : stats.hasError ? (
                      <span className="text-slate-300 text-[10px] font-bold tabular-nums">--</span>
                    ) : (
                      <span className="text-slate-300 text-[10px] font-bold tabular-nums">{stats.pm10}</span>
                    )}
                 </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}