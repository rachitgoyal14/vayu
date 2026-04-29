/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { CITIES, City } from "../lib/cityData";
import { AQICategory, getAQIColor } from "../lib/aqiUtils";

interface IndiaMapProps {
  onCitySelect: (city: City) => void;
  selectedCityId: string;
  category: AQICategory;
}

// Only fly when the selected city actually changes.
function MapController({ center, cityId }: { center: [number, number]; cityId: string }) {
  const map = useMap();
  const prevCityId = useRef<string>("");

  useEffect(() => {
    if (prevCityId.current === cityId) return;
    prevCityId.current = cityId;
    map.flyTo(center, 6, { duration: 1.5 });
  }, [center, cityId, map]);

  return null;
}

export default function IndiaMap({ onCitySelect, selectedCityId, category }: IndiaMapProps) {
  const [hoveredCityId, setHoveredCityId] = useState<string | null>(null);

  const selectedCity = CITIES.find((c) => c.id === selectedCityId) || CITIES[0];
  const aqiColor = getAQIColor(category);

  const createCustomIcon = (cityId: string, isSelected: boolean) => {
    const isHovered = hoveredCityId === cityId;
    const cityName = CITIES.find((c) => c.id === cityId)?.name ?? "";

    if (isSelected) {
      const html = `
        <div style="position:relative; display:flex; align-items:center; justify-content:center; width:40px; height:40px;">
          <!-- Outermost pulse ring -->
          <div style="
            position:absolute; width:40px; height:40px; border-radius:50%;
            background:${aqiColor}18; border:1px solid ${aqiColor}55;
            animation: aqiPingOuter 2.2s ease-out infinite;
          "></div>
          <!-- Mid ring -->
          <div style="
            position:absolute; width:26px; height:26px; border-radius:50%;
            background:${aqiColor}28; border:1.5px solid ${aqiColor}88;
            animation: aqiPingMid 2.2s ease-out infinite 0.3s;
          "></div>
          <!-- Core dot -->
          <div style="
            width:11px; height:11px; border-radius:50%;
            background:${aqiColor}; border:2.5px solid #fff;
            box-shadow: 0 0 14px 3px ${aqiColor}cc, 0 0 4px 1px #fff8;
            position:relative; z-index:2;
          "></div>
          <!-- City label -->
          <div style="
            position:absolute; left:22px; top:50%; transform:translateY(-50%);
            background:rgba(4,4,4,0.95); border:1px solid rgba(255,255,255,0.18);
            padding:5px 11px; border-radius:10px; white-space:nowrap; pointer-events:none;
            box-shadow: 0 2px 16px rgba(0,0,0,0.5), 0 0 12px ${aqiColor}33;
          ">
            <div style="font-size:7.5px; color:${aqiColor}; font-weight:900; text-transform:uppercase; letter-spacing:0.18em; margin-bottom:2px;">● Active Node</div>
            <div style="font-size:11px; color:#fff; font-weight:900; text-transform:uppercase; letter-spacing:0.1em;">${cityName}</div>
          </div>
        </div>
        <style>
          @keyframes aqiPingOuter {
            0%   { transform: scale(1);   opacity: 0.7; }
            70%  { transform: scale(2.2); opacity: 0;   }
            100% { transform: scale(1);   opacity: 0;   }
          }
          @keyframes aqiPingMid {
            0%   { transform: scale(1);   opacity: 0.5; }
            70%  { transform: scale(1.7); opacity: 0;   }
            100% { transform: scale(1);   opacity: 0;   }
          }
        </style>
      `;
      return L.divIcon({ html, className: "", iconSize: [0, 0], iconAnchor: [5, 5] });
    }

    if (isHovered) {
      const html = `
        <div style="position:relative; display:flex; align-items:center; justify-content:center; width:20px; height:20px;">
          <!-- Hover ring -->
          <div style="
            position:absolute; width:20px; height:20px; border-radius:50%;
            background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.35);
          "></div>
          <!-- Dot -->
          <div style="
            width:8px; height:8px; border-radius:50%;
            background:#fff; border:1.5px solid rgba(255,255,255,0.5);
            box-shadow: 0 0 8px 2px rgba(255,255,255,0.5);
            position:relative; z-index:2;
          "></div>
          <!-- Hover label -->
          <div style="
            position:absolute; left:18px; top:50%; transform:translateY(-50%);
            background:rgba(4,4,4,0.92); border:1px solid rgba(255,255,255,0.14);
            padding:4px 9px; border-radius:7px; white-space:nowrap; pointer-events:none;
            box-shadow: 0 2px 12px rgba(0,0,0,0.5);
          ">
            <div style="font-size:10px; color:#fff; font-weight:900; text-transform:uppercase; letter-spacing:0.1em;">${cityName}</div>
          </div>
        </div>
      `;
      return L.divIcon({ html, className: "", iconSize: [0, 0], iconAnchor: [5, 5] });
    }

    // Default dot — small, dim, clean
    const html = `
      <div style="
        width:6px; height:6px; border-radius:50%;
        background:rgba(255,255,255,0.3);
        border:1px solid rgba(255,255,255,0.18);
        transition:all 0.2s;
        box-shadow: 0 0 3px rgba(255,255,255,0.1);
      "></div>
    `;
    return L.divIcon({ html, className: "", iconSize: [0, 0], iconAnchor: [3, 3] });
  };

  return (
    <div className="relative w-full h-full min-h-[550px] bg-[#050505]/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden group shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/5">
      {/* Border layers */}
      <div className="absolute inset-0 rounded-[2.5rem] border border-white/10 pointer-events-none z-30" />
      <div className="absolute inset-[2px] rounded-[2.5rem] border border-white/5 pointer-events-none z-30" />

      {/* AQI-colored inner glow — transitions with category */}
      <motion.div
        className="absolute inset-0 rounded-[2.5rem] pointer-events-none z-30"
        animate={{ opacity: [0.4, 0.65, 0.4] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          boxShadow: `inset 0 0 60px ${aqiColor}33, 0 0 30px ${aqiColor}18`,
        }}
      />

      {/* Map */}
      <div className="absolute inset-0 z-10 opacity-85 contrast-125 brightness-110 saturate-150 grayscale-[0.3]">
        <MapContainer
          center={[selectedCity.lat, selectedCity.lng]}
          zoom={5}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%", background: "#050505" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <MapController center={[selectedCity.lat, selectedCity.lng]} cityId={selectedCityId} />

          {CITIES.map((city) => (
            <Marker
              key={city.id}
              position={[city.lat, city.lng]}
              icon={createCustomIcon(city.id, city.id === selectedCityId)}
              eventHandlers={{
                click: () => onCitySelect(city),
                mouseover: () => setHoveredCityId(city.id),
                mouseout: () => setHoveredCityId(null),
              }}
            />
          ))}
        </MapContainer>
      </div>

      {/* Atmospheric corner glows */}
      <motion.div
        className="absolute -top-24 -left-24 w-96 h-96 blur-[130px] pointer-events-none z-20"
        animate={{ opacity: [0.08, 0.14, 0.08] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        style={{ backgroundColor: aqiColor }}
      />
      <motion.div
        className="absolute -bottom-24 -right-24 w-96 h-96 blur-[130px] pointer-events-none z-20"
        animate={{ opacity: [0.05, 0.10, 0.05] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        style={{ backgroundColor: aqiColor }}
      />

      {/* Vignette overlay */}
      <div className="absolute inset-0 pointer-events-none z-20 rounded-[2.5rem]"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.45) 100%)",
        }}
      />

      {/* Shimmer wash */}
      <motion.div
        animate={{ opacity: [0.06, 0.14, 0.06] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none z-20"
      />

      {/* Scan line sweep */}
      <motion.div
        animate={{ y: ["0%", "100%", "0%"] }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 w-full h-[2px] bg-white/[0.04] z-20 pointer-events-none blur-sm"
      />

      {/* Top-left label */}
      <div className="absolute top-4 left-6 z-20 pointer-events-none">
        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">
          Regional Matrix <span className="opacity-50" style={{ color: aqiColor }}>v4.0</span>
        </h3>
        <p className="text-white text-lg font-light tracking-widest mt-1 uppercase italic">
          India<span className="font-black non-italic">Network</span>
        </p>
      </div>

      {/* Bottom-left: coordinates */}
      <div className="absolute bottom-6 left-6 z-20 pointer-events-none flex flex-col gap-1">
        <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">
          LAT: {selectedCity.lat.toFixed(4)}° N
        </div>
        <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">
          LNG: {selectedCity.lng.toFixed(4)}° E
        </div>
      </div>

      {/* Bottom-right: live indicator with AQI color */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2 items-end">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: aqiColor }}
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="text-white/40 text-[10px] uppercase font-bold tracking-tighter">
            Live Sensor Feed
          </span>
        </div>
        {/* Selected city chip */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCityId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
            style={{
              color: aqiColor,
              borderColor: `${aqiColor}44`,
              backgroundColor: `${aqiColor}12`,
            }}
          >
            {selectedCity.name}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}