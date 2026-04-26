/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { AQICategory, getAQIColor, mapBackendCategory } from "../lib/aqiUtils";
import type { ForecastResult } from "../lib/types";
import AQIMascot from "./AQIMascot";

interface AQICardProps {
  aqi: number;
  category: string;
  pm25: number;
  pm10: number;
  forecast: ForecastResult["forecast"];
  predictionType: "6h" | "12h" | "24h";
  onPredictionChange: (type: "6h" | "12h" | "24h") => void;
}

function toAQICategory(value: string): AQICategory {
  if (value === "Severe" || value === "Hazardous" || value === "Unhealthy") return value;
  return mapBackendCategory(value);
}

export default function AQICard({ 
  aqi, 
  category, 
  pm25, 
  pm10, 
  forecast, 
  predictionType, 
  onPredictionChange 
}: AQICardProps) {
  const activeForecast = forecast[predictionType];
  const displayCategory = activeForecast?.category ?? category;
  const color = activeForecast?.color ?? getAQIColor(toAQICategory(displayCategory));
  const mascotCategory = toAQICategory(displayCategory);

  return (
    <div className="relative group p-10 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 overflow-hidden min-h-[550px] flex flex-col h-full shadow-2xl transition-all duration-1000"
         style={{ backgroundColor: `${color}11` }}>
      
      {/* Cinematic Atmospheric Animated Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Layer 1: Deep Chromatic Haze */}
        <motion.div 
          className="absolute -top-[20%] -left-[20%] w-[140%] h-[140%] blur-[120px] opacity-25 transition-colors duration-1000"
          animate={{
            rotate: [0, 360],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 60,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{
            background: `conic-gradient(from 0deg, transparent, ${color}66, transparent, ${color}33, transparent)`
          }}
        />

        {/* Layer 2: Defined Moving Clouds (SVG Path Based) */}
        <div className="absolute inset-0">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={`cloud-${i}`}
              className="absolute opacity-30"
              initial={{ x: -400 }}
              animate={{ 
                x: [-400, 1600],
                y: [i * 80, i * 85, i * 80],
              }}
              transition={{
                duration: 25 + i * 15,
                repeat: Infinity,
                ease: "linear",
                delay: i * -10
              }}
              style={{ 
                top: `${(i * 15)}%`,
                filter: `drop-shadow(0 0 20px ${color})`
              }}
            >
              <svg width="300" height="120" viewBox="0 0 300 120" fill={color}>
                <path d="M50,100 Q20,100 20,70 Q20,40 50,40 Q50,10 90,10 Q120,10 140,30 Q160,0 200,0 Q240,0 260,30 Q290,30 290,60 Q290,90 260,90 Q260,110 230,110 Q200,110 190,90 Q170,110 130,110 Q100,110 80,90 Q70,100 50,100 Z" opacity="0.6" />
                <path d="M150,110 Q120,110 120,80 Q120,50 150,50 Q150,20 190,20 Q220,20 240,40 Q260,10 300,10 Q340,10 360,40 Q390,40 390,70 Q390,100 360,100 Q360,120 330,120 Q300,120 290,100 Q270,120 230,120 Q200,120 180,100 Q170,110 150,110 Z" opacity="0.4" transform="scale(0.8) translate(50, 20)" />
              </svg>
            </motion.div>
          ))}
        </div>

        {/* Layer 3: Reactive Pollution Particle System */}
        <div className="absolute inset-0">
          {[...Array(aqi > 200 ? 50 : 25)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute bg-white/20 rounded-full"
              style={{
                width: Math.random() * 2.5 + 0.5,
                height: Math.random() * 2.5 + 0.5,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                filter: 'blur(0.5px)',
                backgroundColor: aqi > 150 ? '#ffffff' : color
              }}
              animate={{
                y: [0, Math.random() * 100 - 50],
                x: [0, Math.random() * 500 + 400],
                opacity: [0, 0.5, 0]
              }}
              transition={{
                duration: Math.random() * 5 + 3,
                repeat: Infinity,
                ease: "linear",
                delay: Math.random() * 10
              }}
            />
          ))}
        </div>

        {/* Dynamic Static/Grain Overlay for 'Hazardous' feel */}
        {aqi > 200 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.05 }}
            className="absolute inset-0 pointer-events-none" 
            style={{ backgroundImage: `url("https://grainy-gradients.vercel.app/noise.svg")` }} 
          />
        )}

        {/* Base Glow following the scale */}
        <motion.div 
          className="absolute bottom-0 h-32 w-64 blur-[80px] opacity-40 transition-all duration-1000"
          style={{ 
            backgroundColor: color,
            left: `${Math.min(100, (aqi / 500) * 100)}%`,
            transform: 'translateX(-50%)' 
          }}
        />

        {/* Silhouette of Indian Monuments */}
        <div className="absolute bottom-4 left-0 right-0 h-24 opacity-10 flex items-end justify-center px-10 gap-12 overflow-hidden grayscale brightness-200"
             style={{ filter: `drop-shadow(0 0 20px ${color})` }}>
          <svg viewBox="0 0 100 60" className="w-24 h-24 fill-white">
            <path d="M10,60 L90,60 L90,50 Q75,50 75,40 L70,40 Q70,30 50,30 Q30,30 30,40 L25,40 Q25,50 10,50 Z" />
            <rect x="45" y="10" width="10" height="20" rx="2" />
            <circle cx="50" cy="5" r="5" />
          </svg>
          <svg viewBox="0 0 80 60" className="w-20 h-20 fill-white">
             <rect x="20" y="10" width="40" height="50" rx="4" />
             <rect x="30" y="25" width="20" height="35" rx="10" fill="transparent" stroke="white" strokeWidth="2" />
             <path d="M10,60 L70,60 L60,50 L20,50 Z" />
          </svg>
          <svg viewBox="0 0 100 60" className="w-24 h-24 fill-white">
            <path d="M10,60 L90,60 L90,50 Q75,50 75,40 L70,40 Q70,30 50,30 Q30,30 30,40 L25,40 Q25,50 10,50 Z" />
            <rect x="45" y="10" width="10" height="20" rx="2" />
            <circle cx="50" cy="5" r="5" />
          </svg>
        </div>
      </div>
      
      <div className="absolute top-0 right-0 p-6 opacity-40 z-10 font-black tracking-widest uppercase text-[10px]" style={{ color }}>
        Live Sensor Feed
      </div>

      <div className="flex justify-between items-start mb-12">
        <div>
          <h2 className="text-slate-100 text-5xl font-light tracking-tight mb-2">Atmospheric <span className="font-bold">Matrix</span></h2>
          <p className="text-slate-500 text-sm flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Neural sensor grid synced
          </p>
        </div>
        <div className="text-right">
          <motion.div 
            key={aqi}
            initial={{ scale: 0.8, opacity: 0, filter: "blur(10px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            className="text-8xl font-black leading-none mb-3 tabular-nums transition-colors duration-1000"
            style={{ color, textShadow: `0 0-40px ${color}33` }}
          >
            {aqi}
          </motion.div>
          <div 
            className="px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] inline-block border transition-colors duration-1000"
            style={{ color, borderColor: `${color}44`, backgroundColor: `${color}11` }}
          >
            {displayCategory}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-10 items-center mb-auto">
        <div className="col-span-2 relative flex justify-center">
           <AQIMascot category={mascotCategory} />
           <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] uppercase font-black text-slate-500 tracking-[0.3em] whitespace-nowrap bg-black/40 px-3 py-1 rounded-full border border-white/5">
              Impact Core: {displayCategory.toUpperCase()}
           </div>
        </div>
        
        <div className="col-span-3 space-y-8">
          <div className="grid grid-cols-2 gap-4">
             <div className="p-5 rounded-3xl bg-white/5 border border-white/5 group hover:border-white/10 transition-colors">
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">PM2.5 Matrix</p>
                <div className="flex items-baseline gap-2">
                   <span className="text-white text-3xl font-black tabular-nums">{pm25}</span>
                   <span className="text-slate-500 text-[10px] font-bold">µg/m³</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
                   <motion.div 
                      className="h-full rounded-full"
                      style={{ backgroundColor: color, width: `${Math.min(100, (pm25/150)*100)}%` }}
                   />
                </div>
             </div>
             <div className="p-5 rounded-3xl bg-white/5 border border-white/5 group hover:border-white/10 transition-colors">
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">PM10 Matrix</p>
                <div className="flex items-baseline gap-2">
                   <span className="text-white text-3xl font-black tabular-nums">{pm10}</span>
                   <span className="text-slate-500 text-[10px] font-bold">µg/m³</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
                   <motion.div 
                      className="h-full rounded-full"
                      style={{ backgroundColor: color, width: `${Math.min(100, (pm10/250)*100)}%` }}
                   />
                </div>
             </div>
          </div>

          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">Atmospheric Temporal State</span>
                <span className="text-white text-xs font-bold font-mono">XGBoost v4</span>
             </div>
             <div className="flex bg-black/50 p-1 rounded-2xl border border-white/5 gap-1">
                {(["6h", "12h", "24h"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => onPredictionChange(t)}
                    className={`flex-1 py-2 px-1 rounded-xl transition-all duration-300 relative overflow-hidden group/btn flex flex-col items-center gap-0.5 ${
                      predictionType === t 
                        ? "bg-red-600 text-white shadow-xl scale-[1.02]" 
                        : "text-slate-500 hover:text-slate-100"
                    }`}
                  >
                    <span className="relative z-10 text-[8px] font-black uppercase tracking-tighter">{t} Forecast</span>
                    <span className={`relative z-10 text-sm font-black tabular-nums transition-colors ${predictionType === t ? 'text-white' : 'text-slate-400'}`}>
                      {Math.round(forecast[t].aqi)}
                    </span>
                    {predictionType !== t && (
                      <motion.div 
                        layoutId="active-prediction"
                        className="absolute inset-0 bg-white/5 translate-y-full group-hover/btn:translate-y-0 transition-transform" 
                      />
                    )}
                  </button>
                ))}
             </div>
          </div>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between">
         <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
               <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
               </svg>
            </div>
            <div>
               <p className="text-slate-100 text-sm font-bold tracking-tight">Health Recommendation</p>
               <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-1">
                  {aqi > 200 ? "N95 / FFP2 Masks Requisite" : "Outdoor Activity Safe"}
               </p>
            </div>
         </div>
         <div className="text-right min-w-[120px]">
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest leading-none mb-2">Temporal Intel</p>
            <div className="flex items-baseline justify-end gap-2">
               <motion.p 
                  key={`${predictionType}-${forecast[predictionType].aqi}`}
                  initial={{ y: 10, opacity: 0, filter: "blur(4px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  className="text-5xl font-black tabular-nums leading-none tracking-tighter" 
                  style={{ color }}
               >
                  {Math.round(forecast[predictionType].aqi)}
               </motion.p>
               <span className="text-slate-500 text-[9px] font-black uppercase tracking-tighter">{predictionType}</span>
            </div>
         </div>
      </div>

      {/* AQI Gradient Strip */}
      <div className="absolute bottom-0 left-0 right-0 h-1 flex">
        <div className="h-full w-[10%] bg-emerald-500" />
        <div className="h-full w-[10%] bg-amber-500" />
        <div className="h-full w-[20%] bg-orange-500" />
        <div className="h-full w-[20%] bg-red-500" />
        <div className="h-full w-[20%] bg-violet-600" />
        <div className="h-full w-[20%] bg-rose-950" />
        
        <motion.div 
          className="absolute top-[-6px] w-1.5 h-3.5 bg-white shadow-[0_0_15px_white] rounded-full z-10"
          animate={{ left: `${Math.min(100, (aqi / 500) * 100)}%` }}
          transition={{ type: "spring", stiffness: 40 }}
        />
      </div>
    </div>
  );
}

