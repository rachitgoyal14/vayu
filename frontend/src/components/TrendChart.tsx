/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell } from "recharts";
import { AQICategory, getAQIColor } from "../lib/aqiUtils";
import { motion } from "motion/react";

interface TrendChartProps {
  data: { time: string; value: number }[];
  category: AQICategory;
  statusLabel?: string | null;
}

export default function TrendChart({ data, category, statusLabel }: TrendChartProps) {
  const color = getAQIColor(category);
  const trendColor = "#ef4444";

  const validData = Array.isArray(data) && data.length > 0 ? data : [];

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
            LAST 24HR <span className="text-red-600">AQI READINGS</span> <br/>
            <span className="text-slate-400 opacity-50 font-light italic">OF THE CITY</span>
          </h3>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-3 opacity-60">Linear Temporal Analysis • Sensor Matrix Feed</p>
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
              <YAxis 
                hide 
                domain={[0, 'auto']}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ 
                  backgroundColor: "rgba(10, 10, 10, 0.98)", 
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "24px",
                  padding: "20px",
                  boxShadow: "0 30px 60px rgba(0,0,0,0.9)",
                  backdropFilter: "blur(40px)"
                }}
                itemStyle={{ color: "#fff", fontSize: "16px", fontWeight: "900", fontFamily: "monospace" }}
                labelStyle={{ color: "rgba(255,255,255,0.3)", fontSize: "9px", fontWeight: "800", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "2px" }}
                formatter={(value) => [`${value} INDEX`, "AQI LOAD"]}
              />
              <ReferenceLine y={100} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <Bar 
                dataKey="value" 
                radius={[10, 10, 0, 0]}
                animationDuration={1500}
              >
                {validData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={trendColor}
                    fillOpacity={Math.max(0.25, Math.min(1, (entry.value || 0) / 220))}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-8 flex justify-between items-center text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">
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
