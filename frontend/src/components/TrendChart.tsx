/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";
import { AQICategory, getAQIColor, getCategory } from "../lib/aqiUtils";
import { motion } from "motion/react";

interface TrendChartProps {
  data: { time: string; value: number }[];
  category: AQICategory;
  statusLabel?: string | null;
  isLoading?: boolean;
}

/* ─── Loading Skeleton ──────────────────────────────────────────────────── */
function TrendChartSkeleton() {
  // Fixed bar heights so they don't re-randomise on every render
  const BARS = [42, 68, 55, 80, 47, 91, 63, 38, 74, 59, 85, 52, 70, 44, 66, 78, 50, 88, 61, 73, 45, 83, 57, 40];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full min-h-[500px] p-10 rounded-[3rem] bg-[#0A0A0A]/40 backdrop-blur-3xl border border-white/5 overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.6)] relative"
    >
      {/* Scan-line overlay */}
      <motion.div
        className="absolute inset-0 opacity-[0.025] pointer-events-none z-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.12) 2px, rgba(255,255,255,0.12) 4px)",
        }}
        animate={{ backgroundPositionY: ["0px", "80px"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
      />

      {/* Ambient corner glow */}
      <motion.div
        className="absolute top-0 right-0 w-64 h-64 blur-[120px] rounded-full pointer-events-none -mr-32 -mt-32"
        animate={{ opacity: [0.03, 0.08, 0.03] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ background: "radial-gradient(ellipse, #94a3b844, transparent 70%)" }}
      />

      {/* Header skeleton */}
      <div className="flex justify-between items-start mb-14 relative z-10">
        <div className="space-y-3">
          {/* Title lines */}
          <div className="h-8 w-64 rounded-2xl bg-white/[0.06] animate-pulse" />
          <div className="h-8 w-48 rounded-2xl bg-white/[0.04] animate-pulse" />
          <div className="h-2.5 w-72 rounded-full bg-white/[0.03] animate-pulse mt-1" />
        </div>

        <div className="flex items-center gap-10">
          <div className="flex flex-col items-end gap-2">
            <div className="h-2.5 w-24 rounded-full bg-white/[0.05] animate-pulse" />
            <div className="h-3 w-28 rounded-full bg-white/[0.04] animate-pulse" />
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <motion.div
              className="w-2 h-2 rounded-full border-2 border-slate-700"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
          </div>
        </div>
      </div>

      {/* Bar chart skeleton */}
      <div className="h-[300px] w-full relative z-10 flex items-end gap-[2%] px-1">
        {BARS.map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t-lg bg-white/[0.05] origin-bottom"
            style={{ height: `${h}%` }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (i % 8) * 0.12,
            }}
          />
        ))}

        {/* Sweeping highlight bar */}
        <motion.div
          className="absolute inset-y-0 w-[4%] pointer-events-none rounded-lg"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(255,255,255,0.04), transparent)",
          }}
          animate={{ left: ["-4%", "104%"] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Legend skeleton */}
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 relative z-10">
        {[56, 72, 48, 64, 52, 44].map((w, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white/10 animate-pulse" />
            <div
              className="h-2.5 rounded-full bg-white/[0.04] animate-pulse"
              style={{ width: w }}
            />
          </div>
        ))}
      </div>

      {/* Footer row skeleton */}
      <div className="mt-6 flex justify-between items-center relative z-10">
        <div className="flex gap-10">
          <div className="h-2.5 w-24 rounded-full bg-white/[0.04] animate-pulse" />
          <div className="h-2.5 w-20 rounded-full bg-white/[0.04] animate-pulse" />
        </div>
        <div className="flex gap-4 items-center">
          <div className="w-2 h-px bg-slate-800" />
          <div className="h-2.5 w-36 rounded-full bg-white/[0.04] animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function TrendChart({ data, category, statusLabel, isLoading = false }: TrendChartProps) {
  if (isLoading) {
    return <TrendChartSkeleton />;
  }

  const validData = Array.isArray(data) && data.length > 0 ? data : [];

  const values = validData.map((d) => d.value).filter((v) => v > 0);
  const minVal = values.length > 0 ? Math.max(0, Math.min(...values) * 0.85) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) * 1.1 : 300;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="w-full min-h-[500px] p-10 rounded-[3rem] bg-[#0A0A0A]/40 backdrop-blur-3xl border border-white/5 overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.6)] relative"
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-slate-500/5 blur-[120px] rounded-full -mr-32 -mt-32" />

      <div className="flex justify-between items-start mb-14 relative z-10">
        <div>
          <h3 className="text-white text-3xl font-black tracking-tight uppercase leading-tight">
            LAST 24HR <span className="text-red-600">AQI READINGS</span> <br />
            <span className="text-slate-400 opacity-50 font-light italic">OF THE CITY</span>
          </h3>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-3 opacity-60">
            Linear Temporal Analysis • Supabase Station Feed
          </p>
        </div>
        <div className="flex items-center gap-10">
          <div className="flex flex-col items-end">
            <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest">Baseline Grid</span>
            <span className="text-white text-xs font-black">STABLE @ 100</span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full border-2 border-red-600 animate-ping" />
          </div>
        </div>
      </div>

      <div className="h-[300px] w-full relative z-10">
        {validData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm font-medium">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={validData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="rgba(255,255,255,0.03)" />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10, fontWeight: 900 }}
                interval={2}
              />
              <YAxis hide domain={[minVal, maxVal]} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                contentStyle={{
                  backgroundColor: "rgba(10, 10, 10, 0.98)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "24px",
                  padding: "20px",
                  boxShadow: "0 30px 60px rgba(0,0,0,0.9)",
                  backdropFilter: "blur(40px)",
                }}
                itemStyle={{ color: "#fff", fontSize: "16px", fontWeight: "900", fontFamily: "monospace" }}
                labelStyle={{
                  color: "rgba(255,255,255,0.3)",
                  fontSize: "9px",
                  fontWeight: "800",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                }}
                formatter={(value) => {
                  const numValue = Number(value) || 0;
                  const cat = getCategory(numValue);
                  return [`${Math.round(numValue)} — ${cat}`, "AQI"];
                }}
              />
              <ReferenceLine y={100} stroke="rgba(139,195,74,0.15)"  strokeDasharray="3 3" />
              <ReferenceLine y={200} stroke="rgba(255,193,7,0.15)"   strokeDasharray="3 3" />
              <ReferenceLine y={300} stroke="rgba(255,112,67,0.15)"  strokeDasharray="3 3" />
              <ReferenceLine y={400} stroke="rgba(229,57,53,0.15)"   strokeDasharray="3 3" />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={1200}>
                {validData.map((entry, index) => {
                  const barCategory = getCategory(entry.value ?? 0);
                  const barColor = getAQIColor(barCategory);
                  return <Cell key={`cell-${index}`} fill={barColor} fillOpacity={0.75} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* CPCB legend */}
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 relative z-10">
        {(
          [
            ["Good",        "#00C853", "≤50"],
            ["Satisfactory","#8BC34A", "≤100"],
            ["Moderate",    "#FFC107", "≤200"],
            ["Poor",        "#FF7043", "≤300"],
            ["Very Poor",   "#E53935", "≤400"],
            ["Severe",      "#7B1FA2", ">400"],
          ] as const
        ).map(([label, color, range]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              {label} {range}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-between items-center text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">
        <div className="flex gap-10">
          <span>Grid Refresh: 10hz</span>
          <span>Latency: 4ms</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="w-2 h-[1px] bg-slate-700" />
          <span>{statusLabel ?? "AI Predictive Overlays Active"}</span>
        </div>
      </div>
    </motion.div>
  );
}
