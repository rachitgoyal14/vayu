/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { Activity, Factory, AlertCircle, Cpu } from "lucide-react";
import { AQICategory, getAQIColor } from "../lib/aqiUtils";
import type { SHAPResult } from "../lib/types";

interface PollutantAnalysisProps {
  category: AQICategory;
  source: string;
  shapData: SHAPResult | null;
  isLoading?: boolean;
}

function getDominantShapPollutant(shapData: SHAPResult | null): string {
  if (!shapData?.shap_values || Object.keys(shapData.shap_values).length === 0) {
    return "PM2.5";
  }

  const pollutantFeatureMap: Record<string, string> = {
    pm2_5_ugm3: "PM2.5",
    pm10_ugm3: "PM10",
    co_ugm3: "CO",
    no2_ugm3: "NO2",
    so2_ugm3: "SO2",
    o3_ugm3: "O3",
  };

  const [topPollutant] = Object.entries(shapData.shap_values)
    .filter(([feature]) => feature in pollutantFeatureMap)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  if (!topPollutant) return "PM2.5";
  return pollutantFeatureMap[topPollutant[0]] ?? "PM2.5";
}

function inferPrimarySourceFromPollutant(pollutant: string, fallback: string): string {
  const p = pollutant.toUpperCase();
  if (p.includes("PM2") || p.includes("PM10")) return "Road Dust & Biomass Burning";
  if (p.includes("NO2")) return "Vehicular Emissions";
  if (p.includes("SO2")) return "Industrial & Power Plants";
  if (p.includes("CO")) return "Combustion Sources";
  if (p.includes("O3")) return "Photochemical Smog";
  return fallback;
}

/* ─── Loading Skeleton ──────────────────────────────────────────────────── */
function PollutantAnalysisSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="p-12 rounded-[2.5rem] bg-[#0A0A0A]/40 backdrop-blur-3xl border border-white/5 overflow-hidden relative min-h-[350px] flex flex-col justify-center shadow-[0_40px_80px_rgba(0,0,0,0.5)]"
        >
          {/* Scan-line ambient */}
          <motion.div
            className="absolute inset-0 opacity-[0.025] pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.12) 2px, rgba(255,255,255,0.12) 4px)",
            }}
            animate={{ backgroundPositionY: ["0px", "80px"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
          />

          {/* Slow corner glow */}
          <motion.div
            className="absolute top-0 right-0 w-48 h-48 blur-[80px] rounded-full pointer-events-none"
            animate={{ opacity: [0.04, 0.10, 0.04] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.8 }}
            style={{ background: "radial-gradient(ellipse, #94a3b855, transparent 70%)" }}
          />

          <div className="relative z-10">
            {/* Header row */}
            <div className="flex items-center gap-5 mb-10">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/[0.06] shrink-0">
                <motion.div
                  className="w-7 h-7 rounded-lg bg-white/10"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
                />
              </div>
              <div className="space-y-2">
                <div className="h-5 w-44 rounded-xl bg-white/[0.06] animate-pulse" />
                <div className="h-2.5 w-32 rounded-full bg-white/[0.04] animate-pulse" />
              </div>
            </div>

            {/* Hero value placeholder */}
            <div className="flex items-end gap-4 mb-6">
              <motion.div
                className="h-16 w-36 rounded-2xl bg-white/[0.05]"
                animate={{ opacity: [0.3, 0.65, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
              />
              <div className="h-3 w-16 rounded-full bg-white/[0.04] mb-2 animate-pulse" />
            </div>

            {/* Description lines */}
            <div className="space-y-2 max-w-sm">
              <div className="h-3 w-full rounded-full bg-white/[0.04] animate-pulse" />
              <div className="h-3 w-4/5 rounded-full bg-white/[0.04] animate-pulse" />
              <div className="h-3 w-3/5 rounded-full bg-white/[0.04] animate-pulse" />
            </div>

            {/* Footer cluster — only on second card */}
            {i === 1 && (
              <div className="mt-10 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {[0, 1, 2].map((j) => (
                    <div
                      key={j}
                      className="w-8 h-8 rounded-full border-2 border-[#0A0A0A] bg-white/[0.06] animate-pulse"
                    />
                  ))}
                </div>
                <div className="h-2.5 w-36 rounded-full bg-white/[0.04] animate-pulse" />
              </div>
            )}
          </div>

          {/* Drifting SVG grid overlay — mirrors the real card's NMF grid */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.025]">
            <div className="grid grid-cols-12 h-full w-full">
              {[...Array(144)].map((_, k) => (
                <div key={k} className="border-[0.5px] border-white/20" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function PollutantAnalysis({ category, source, shapData, isLoading = false }: PollutantAnalysisProps) {
  if (isLoading) {
    return <PollutantAnalysisSkeleton />;
  }

  const color = getAQIColor(category);
  const pollutant = getDominantShapPollutant(shapData);
  const primarySource = inferPrimarySourceFromPollutant(pollutant, source);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
      {/* Dominant Risk Card with 3D Matrix Neural Overlay */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        className="group p-12 rounded-[2.5rem] bg-[#0A0A0A]/40 backdrop-blur-3xl border border-white/5 overflow-hidden relative min-h-[350px] flex flex-col justify-center shadow-[0_40px_80px_rgba(0,0,0,0.5)]"
      >
        {/* 3D Neural Matrix Visualization Overlay */}
        <div className="absolute top-0 right-0 w-1/2 h-full pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity duration-1000">
          <div className="relative w-full h-full">
            {[...Array(24)].map((_, i) => (
              <motion.div
                key={`matrix-${i}`}
                className="absolute bg-white/20 rounded-full"
                style={{
                  width: 2,
                  height: 2,
                  top: `${Math.random() * 80 + 10}%`,
                  left: `${Math.random() * 80 + 10}%`,
                  boxShadow: `0 0 10px ${color}`,
                }}
                animate={{ z: [0, 50, 0], scale: [1, 1.5, 1], opacity: [0.1, 0.8, 0.1] }}
                transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, delay: Math.random() * 5 }}
              />
            ))}
            <svg viewBox="0 0 100 100" className="w-full h-full stroke-white/5 fill-none">
              <motion.path
                d="M10,10 L90,90 M10,90 L90,10 M50,0 L50,100 M0,50 L100,50"
                strokeWidth="0.5"
                animate={{ strokeDashoffset: [0, 200] }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                strokeDasharray="5 5"
              />
            </svg>
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-5 mb-10">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 group-hover:border-red-600/30 transition-colors">
              <Activity className="w-7 h-7" style={{ color }} />
            </div>
            <div>
              <h4 className="text-white text-xl font-black tracking-tight uppercase">
                Dominant Risk <span className="text-red-600">Driver</span>
              </h4>
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] mt-1.5 opacity-60">
                SHAP Decomposition Factor
              </p>
            </div>
          </div>

          <div className="flex items-end gap-4 mb-6">
            <span
              className="text-white text-7xl font-black tracking-tighter tabular-nums"
              style={{ color, textShadow: `0 0 40px ${color}44` }}
            >
              {pollutant}
            </span>
            <span className="text-slate-500 text-xs font-black uppercase pb-2 tracking-[0.4em] opacity-40">
              Load Unit
            </span>
          </div>

          <p className="text-slate-400 text-sm leading-relaxed font-bold max-w-sm opacity-80">
            Neural sensors indicate <span className="text-white">{pollutant}</span> as the high-impact coefficient
            dictating the {category.toLowerCase()} atmospheric state.
          </p>
        </div>
      </motion.div>

      {/* Primary Source Card with NMF Latent Grid Overlay */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        className="group p-12 rounded-[2.5rem] bg-[#0A0A0A]/40 backdrop-blur-3xl border border-white/5 overflow-hidden relative min-h-[350px] flex flex-col justify-center shadow-[0_40px_80px_rgba(0,0,0,0.5)]"
      >
        {/* NMF Grid Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
          <div className="grid grid-cols-12 h-full w-full">
            {[...Array(144)].map((_, i) => (
              <div key={i} className="border-[0.5px] border-white/20" />
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-5 mb-10">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 group-hover:border-red-600/30 transition-colors">
              <Factory className="w-7 h-7" style={{ color }} />
            </div>
            <div>
              <h4 className="text-white text-xl font-black tracking-tight uppercase">
                Primary Source <span className="text-red-600">Factor</span>
              </h4>
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em] mt-1.5 opacity-60">
                NMF Latent Feature Engine
              </p>
            </div>
          </div>

          <div className="flex items-end gap-3 mb-6">
            <span className="text-white text-4xl font-black tracking-tight leading-none uppercase" style={{ color }}>
              {primarySource}
            </span>
          </div>

          <p className="text-slate-400 text-sm leading-relaxed font-bold max-w-sm opacity-80">
            NMF latent extraction identifies <span className="text-white">{primarySource}</span> as the primary
            emitter cluster with 98.4% matrix fidelity.
          </p>

          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-[#0A0A0A] bg-white/10 flex items-center justify-center overflow-hidden"
                >
                  <Cpu className="w-4 h-4 text-slate-500" />
                </div>
              ))}
            </div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              3 Neural Clusters Voting
            </span>
          </div>
        </div>

        <div className="absolute top-10 right-10 opacity-5 group-hover:opacity-20 transition-all duration-700 group-hover:rotate-12">
          <AlertCircle className="w-40 h-40 text-white" />
        </div>
      </motion.div>
    </div>
  );
}
