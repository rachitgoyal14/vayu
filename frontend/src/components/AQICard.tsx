/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence, useMotionValue, useSpring } from "motion/react";
import { useMemo, useEffect, useState } from "react";
import { getAQIColor, getCategory } from "../lib/aqiUtils";
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
  isLoading?: boolean;
}

const RENDER_SATIRICAL_LINES = [
  "Bribing Render's free tier to wake up...",
  "Cold start detected. Server is yawning.",
  "Backend hibernating since last Tuesday.",
  "Spinning up 512MB of pure optimism.",
  "Waiting for the hamster to get back on the wheel.",
  "Free tier moment. Please hold.",
  "Server dreaming of $7/month upgrade.",
  "Sending TCP packet. And a prayer.",
  "Container booting. ETA: geological epoch.",
  "Poking the sleeping Docker daemon.",
  "Your request is 47th in the queue of 1.",
  "Render free instance: technically alive.",
];

/** Cycles through satirical lines on a real interval — not just on render. */
function useRotatingText(lines: string[], interval = 2800) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % lines.length), interval);
    return () => clearInterval(id);
  }, [lines, interval]);
  return lines[idx];
}

const PARTICLES = Array.from({ length: 50 }, (_, i) => ({
  w: ((i * 7 + 3) % 25) / 10 + 0.5,
  h: ((i * 11 + 5) % 25) / 10 + 0.5,
  top: ((i * 37) % 100),
  left: ((i * 53) % 100),
  dy: ((i * 29) % 100) - 50,
  dx: ((i * 17) % 500) + 400,
  dur: ((i * 13) % 50) / 10 + 3,
  delay: ((i * 19) % 100) / 10,
}));

/* ─── Health Check Banner ───────────────────────────────────────────────── */
function HealthCheckBanner() {
  const HEALTH_URL = "https://vayu-6ss8.onrender.com/health";
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={HEALTH_URL}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex items-center justify-between w-full px-5 py-4 rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: hovered
          ? "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(220,38,38,0.10) 100%)"
          : "linear-gradient(135deg, rgba(245,158,11,0.09) 0%, rgba(220,38,38,0.05) 100%)",
        border: hovered ? "1px solid rgba(245,158,11,0.6)" : "1px solid rgba(245,158,11,0.35)",
        boxShadow: hovered
          ? "0 0 24px rgba(245,158,11,0.18), inset 0 0 24px rgba(245,158,11,0.04)"
          : "0 0 12px rgba(245,158,11,0.08)",
      }}
    >
      {/* Shimmer sweep on hover */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={hovered ? { x: ["−100%", "200%"] } : { x: "−100%" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        style={{
          background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.12), transparent)",
          width: "60%",
        }}
      />

      {/* Left: status dot + label */}
      <div className="flex items-center gap-3 z-10">
        {/* Triple-ring pulsing amber beacon */}
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full bg-amber-400"
            animate={{ scale: [1, 2.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.span
            className="absolute inline-flex rounded-full bg-amber-400/40"
            style={{ width: "180%", height: "180%" }}
            animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
          />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_8px_2px_rgba(245,158,11,0.8)]" />
        </span>

        <div className="leading-none">
          <p className="text-amber-300 text-[11px] font-black uppercase tracking-widest mb-1">
            ⚠ Backend Sleeping — Click to Wake
          </p>
          {/* Full highlighted URL */}
          <motion.p
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="font-mono text-[10px] font-bold tracking-wide"
            style={{
              color: "#fbbf24",
              textShadow: "0 0 8px rgba(251,191,36,0.6)",
            }}
          >
            {HEALTH_URL}
          </motion.p>
        </div>
      </div>

      {/* Right: animated arrow */}
      <div className="flex items-center gap-2 z-10 shrink-0">
        <motion.div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{
            background: hovered ? "rgba(245,158,11,0.25)" : "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.4)",
          }}
          animate={{ scale: hovered ? 1.05 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <span className="text-amber-300 text-[10px] font-black uppercase tracking-widest">Open</span>
          <motion.span
            className="text-amber-300 text-sm leading-none"
            animate={{ x: [0, 3, 0], y: [0, -3, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            ↗
          </motion.span>
        </motion.div>
      </div>
    </a>
  );
}

/* ─── Loading Skeleton ──────────────────────────────────────────────────── */
function LoadingSkeleton() {
  const satiricalLine = useRotatingText(RENDER_SATIRICAL_LINES);
  const [progress, setProgress] = useState(5);

  // Fake jittery progress bar that stalls like a real cold-start
  useEffect(() => {
    const steps = [12, 18, 19, 22, 21, 35, 36, 37, 38, 50, 49, 52, 51, 60];
    let i = 0;
    const id = setInterval(() => {
      setProgress(steps[i % steps.length]);
      i++;
    }, 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative p-10 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 overflow-hidden min-h-[550px] flex flex-col h-full shadow-2xl">
      {/* Animated scan-line background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)",
          }}
          animate={{ backgroundPositionY: ["0px", "100px"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-0 blur-[120px]"
          animate={{ opacity: [0.05, 0.12, 0.05] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ background: "radial-gradient(ellipse at 50% 50%, #94a3b855 0%, transparent 70%)" }}
        />
        {/* Diagonal sweep */}
        <motion.div
          className="absolute inset-0"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 1.5 }}
          style={{
            width: "40%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.015), transparent)",
          }}
        />
      </div>

      {/* Top badge */}
      <div className="absolute top-0 right-0 p-6 opacity-40 z-10 font-black tracking-widest uppercase text-[10px] text-slate-500">
        Awaiting Feed
      </div>

      {/* Header skeleton */}
      <div className="flex justify-between items-start mb-12 relative z-10">
        <div className="space-y-3">
          <div className="h-10 w-72 rounded-2xl bg-white/5 animate-pulse" />
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-700 animate-pulse" />
            <div className="h-3.5 w-44 rounded-full bg-white/5 animate-pulse" />
          </div>
        </div>

        <div className="text-right">
          <div className="relative">
            <motion.div
              className="text-8xl font-black leading-none mb-3 tabular-nums text-slate-700 select-none"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              ???
            </motion.div>
            <motion.div
              className="absolute inset-0 blur-2xl rounded-full"
              animate={{ opacity: [0, 0.15, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "#94a3b8" }}
            />
          </div>
          <div className="px-5 py-1.5 rounded-full inline-block border border-white/10 bg-white/5">
            <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Middle content skeleton */}
      <div className="grid grid-cols-5 gap-10 items-center mb-auto relative z-10">
        <div className="col-span-2 flex justify-center items-center">
          {/* Spinning gear with inner orbit */}
          <div className="relative w-36 h-36 flex items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-dashed border-slate-700/50"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute rounded-full border border-slate-700/30"
              style={{ inset: "16px" }}
              animate={{ rotate: [0, -360] }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            />
            {/* Orbiting dot */}
            <motion.div
              className="absolute w-3 h-3 rounded-full bg-slate-600"
              style={{ top: "8px", left: "50%", marginLeft: "-6px" }}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              // orbit by rotating the container reference
            />
            <motion.div
              className="text-4xl select-none"
              animate={{
                scale: [1, 1.12, 1],
                rotate: [0, 5, -5, 0],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              💤
            </motion.div>
          </div>
        </div>

        <div className="col-span-3 space-y-8">
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="p-5 rounded-3xl bg-white/5 border border-white/5 space-y-3">
                <div className="h-2.5 w-20 rounded-full bg-white/10 animate-pulse" />
                <div className="h-8 w-16 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-slate-700/50"
                    animate={{ width: ["0%", "60%", "20%", "80%", "0%"] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Forecast tabs skeleton */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-48 rounded-full bg-white/10 animate-pulse" />
              <div className="h-3 w-20 rounded-full bg-white/5 animate-pulse" />
            </div>
            <div className="flex bg-black/50 p-1 rounded-2xl border border-white/5 gap-1">
              {["6h", "12h", "24h"].map((t, i) => (
                <div
                  key={t}
                  className="flex-1 py-3 rounded-xl bg-white/[0.03] flex flex-col items-center gap-1"
                >
                  <div
                    className="h-2 w-12 rounded-full bg-white/10 animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                  <div
                    className="h-4 w-8 rounded bg-white/5 animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-white/5 relative z-10 space-y-4">
        {/* ── Prominent Health Check Banner ── */}
        <HealthCheckBanner />

        {/* ── Status row ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
              <motion.span
                className="text-2xl select-none"
                animate={{ rotate: [0, -15, 15, -15, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                🌙
              </motion.span>
            </div>
            <div className="space-y-1.5">
              <p className="text-slate-100 text-sm font-bold tracking-tight">Render Free Tier Protocol</p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={satiricalLine}
                  initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                  transition={{ duration: 0.4 }}
                  className="text-slate-500 text-[10px] uppercase font-black tracking-widest"
                >
                  {satiricalLine}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Jittery wake progress */}
          <div className="text-right min-w-[140px] space-y-2">
            <p className="text-slate-600 text-[9px] font-black uppercase tracking-widest">Wake Progress</p>
            <div className="h-1.5 w-36 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-amber-600/50"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <p className="text-slate-700 text-[8px] font-black tracking-wider">technically, soon™</p>
          </div>
        </div>
      </div>

      {/* AQI Gradient Strip — greyed out */}
      <div className="absolute bottom-0 left-0 right-0 h-1 flex opacity-20">
        {["bg-slate-600", "bg-slate-600", "bg-slate-600", "bg-slate-600", "bg-slate-600", "bg-slate-600"].map(
          (cls, i) => (
            <div key={i} className={`h-full flex-1 ${cls}`} />
          )
        )}
        <motion.div
          className="absolute top-[-6px] w-1.5 h-3.5 bg-slate-500 rounded-full z-10"
          animate={{ left: ["5%", "95%", "5%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

/* ─── Main AQICard ──────────────────────────────────────────────────────── */
export default function AQICard({
  aqi,
  pm25,
  pm10,
  forecast,
  predictionType,
  onPredictionChange,
  isLoading = false,
}: Omit<AQICardProps, "category"> & { category?: string }) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Derive category exclusively from the CPCB AQI number.
  const displayCategory = getCategory(aqi);
  const color = getAQIColor(displayCategory);

  const activeForecast = forecast[predictionType];
  const forecastColor =
    activeForecast?.color ?? getAQIColor(getCategory(Math.round(activeForecast?.aqi ?? aqi)));

  const activeParticles = PARTICLES.slice(0, aqi > 200 ? 50 : 25);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="loaded-card"
        initial={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative group p-10 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 overflow-hidden min-h-[550px] flex flex-col h-full shadow-2xl transition-all duration-1000"
        style={{ backgroundColor: `${color}11` }}
      >
        {/* Cinematic Atmospheric Animated Background */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <motion.div
            className="absolute -top-[20%] -left-[20%] w-[140%] h-[140%] blur-[120px] opacity-25 transition-colors duration-1000"
            animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            style={{
              background: `conic-gradient(from 0deg, transparent, ${color}66, transparent, ${color}33, transparent)`,
            }}
          />

          {/* Drifting clouds */}
          <div className="absolute inset-0">
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={`cloud-${i}`}
                className="absolute opacity-30"
                initial={{ x: -400 }}
                animate={{ x: [-400, 1600], y: [i * 80, i * 85, i * 80] }}
                transition={{
                  duration: 25 + i * 15,
                  repeat: Infinity,
                  ease: "linear",
                  delay: i * -10,
                }}
                style={{ top: `${i * 15}%`, filter: `drop-shadow(0 0 20px ${color})` }}
              >
                <svg width="300" height="120" viewBox="0 0 300 120" fill={color}>
                  <path
                    d="M50,100 Q20,100 20,70 Q20,40 50,40 Q50,10 90,10 Q120,10 140,30 Q160,0 200,0 Q240,0 260,30 Q290,30 290,60 Q290,90 260,90 Q260,110 230,110 Q200,110 190,90 Q170,110 130,110 Q100,110 80,90 Q70,100 50,100 Z"
                    opacity="0.6"
                  />
                  <path
                    d="M150,110 Q120,110 120,80 Q120,50 150,50 Q150,20 190,20 Q220,20 240,40 Q260,10 300,10 Q340,10 360,40 Q390,40 390,70 Q390,100 360,100 Q360,120 330,120 Q300,120 290,100 Q270,120 230,120 Q200,120 180,100 Q170,110 150,110 Z"
                    opacity="0.4"
                    transform="scale(0.8) translate(50, 20)"
                  />
                </svg>
              </motion.div>
            ))}
          </div>

          {/* Particles */}
          <div className="absolute inset-0">
            {activeParticles.map((p, i) => (
              <motion.div
                key={`particle-${i}`}
                className="absolute rounded-full"
                style={{
                  width: p.w,
                  height: p.h,
                  top: `${p.top}%`,
                  left: `${p.left}%`,
                  filter: "blur(0.5px)",
                  backgroundColor: aqi > 150 ? "#ffffff" : color,
                }}
                animate={{ y: [0, p.dy], x: [0, p.dx], opacity: [0, 0.5, 0] }}
                transition={{
                  duration: p.dur,
                  repeat: Infinity,
                  ease: "linear",
                  delay: p.delay,
                }}
              />
            ))}
          </div>

          {aqi > 200 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.05 }}
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
              }}
            />
          )}

          <motion.div
            className="absolute bottom-0 h-32 w-64 blur-[80px] opacity-40 transition-all duration-1000"
            style={{
              backgroundColor: color,
              left: `${Math.min(100, (aqi / 500) * 100)}%`,
              transform: "translateX(-50%)",
            }}
          />

          {/* City silhouettes */}
          <div
            className="absolute bottom-4 left-0 right-0 h-24 opacity-10 flex items-end justify-center px-10 gap-12 overflow-hidden grayscale brightness-200"
            style={{ filter: `drop-shadow(0 0 20px ${color})` }}
          >
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

        {/* Live badge */}
        <div
          className="absolute top-0 right-0 p-6 opacity-40 z-10 font-black tracking-widest uppercase text-[10px]"
          style={{ color }}
        >
          Live Sensor Feed
        </div>

        {/* Header */}
        <div className="flex justify-between items-start mb-12 relative z-10">
          <div>
            <h2 className="text-slate-100 text-5xl font-light tracking-tight mb-2">
              Atmospheric <span className="font-bold">Matrix</span>
            </h2>
            <p className="text-slate-500 text-sm flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Neural sensor grid synced
            </p>
          </div>
          <div className="text-right">
            <motion.div
              key={aqi}
              initial={{ scale: 0.8, opacity: 0, filter: "blur(10px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              className="text-8xl font-black leading-none mb-3 tabular-nums transition-colors duration-1000"
              style={{ color, textShadow: `0 0 40px ${color}33` }}
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

        {/* Middle: Mascot + Stats */}
        <div className="grid grid-cols-5 gap-10 items-center mb-auto relative z-10">
          <div className="col-span-2 relative flex justify-center">
            <AQIMascot category={displayCategory} />
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] uppercase font-black text-slate-500 tracking-[0.3em] whitespace-nowrap bg-black/40 px-3 py-1 rounded-full border border-white/5">
              Impact Core: {displayCategory.toUpperCase()}
            </div>
          </div>

          <div className="col-span-3 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">PM2.5 Matrix</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-3xl font-black tabular-nums">{pm25}</span>
                  <span className="text-slate-500 text-[10px] font-bold">µg/m³</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    animate={{ width: `${Math.min(100, (pm25 / 150) * 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
              <div className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">PM10 Matrix</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-3xl font-black tabular-nums">{pm10}</span>
                  <span className="text-slate-500 text-[10px] font-bold">µg/m³</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    animate={{ width: `${Math.min(100, (pm10 / 250) * 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>

            {/* Forecast Buttons */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">
                  Atmospheric Temporal State
                </span>
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
                    <span className="relative z-10 text-[8px] font-black uppercase tracking-tighter">
                      {t} Forecast
                    </span>
                    <span
                      className={`relative z-10 text-sm font-black tabular-nums transition-colors ${
                        predictionType === t ? "text-white" : "text-slate-400"
                      }`}
                    >
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

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
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
            <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest leading-none mb-2">
              Temporal Intel
            </p>
            <div className="flex items-baseline justify-end gap-2">
              <motion.p
                key={`${predictionType}-${forecast[predictionType].aqi}`}
                initial={{ y: 10, opacity: 0, filter: "blur(4px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                className="text-5xl font-black tabular-nums leading-none tracking-tighter"
                style={{ color: forecastColor }}
              >
                {Math.round(forecast[predictionType].aqi)}
              </motion.p>
              <span className="text-slate-500 text-[9px] font-black uppercase tracking-tighter">
                {predictionType}
              </span>
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
      </motion.div>
    </AnimatePresence>
  );
}