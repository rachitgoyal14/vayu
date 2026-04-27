/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { motion } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { CITIES, City } from "../lib/cityData";
import { AQICategory, getAQIColor } from "../lib/aqiUtils";

interface IndiaMapProps {
  onCitySelect: (city: City) => void;
  selectedCityId: string;
  category: AQICategory;
}

// Only fly when the selected city actually changes — prevents constant
// recalibration while the user is panning/zooming manually.
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

  const createCustomIcon = (cityId: string, isSelected: boolean) => {
    const aqiColor = getAQIColor(category);
    const isHovered = hoveredCityId === cityId;
    const cityName = CITIES.find((c) => c.id === cityId)?.name ?? "";

    if (isSelected) {
      // Large pulsing ring + filled dot for the active city
      const html = `
        <div style="position:relative; display:flex; align-items:center; justify-content:center; width:32px; height:32px;">
          <div style="
            position:absolute; width:32px; height:32px; border-radius:50%;
            background:${aqiColor}22; border:1.5px solid ${aqiColor}66;
            animation: aqiPing 1.8s ease-out infinite;
          "></div>
          <div style="
            position:absolute; width:20px; height:20px; border-radius:50%;
            background:${aqiColor}33; border:1.5px solid ${aqiColor}99;
          "></div>
          <div style="
            width:10px; height:10px; border-radius:50%;
            background:${aqiColor}; border:2px solid #fff;
            box-shadow: 0 0 8px ${aqiColor};
          "></div>
          <div style="
            position:absolute; left:18px; top:50%; transform:translateY(-50%);
            background:rgba(0,0,0,0.92); border:1px solid rgba(255,255,255,0.15);
            padding:4px 10px; border-radius:8px; white-space:nowrap; pointer-events:none;
          ">
            <div style="font-size:8px; color:rgba(255,255,255,0.4); font-weight:900; text-transform:uppercase; letter-spacing:0.15em; margin-bottom:2px;">Active Node</div>
            <div style="font-size:11px; color:#fff; font-weight:900; text-transform:uppercase; letter-spacing:0.1em;">${cityName}</div>
          </div>
        </div>
        <style>
          @keyframes aqiPing {
            0%   { transform: scale(1);   opacity: 0.6; }
            70%  { transform: scale(1.8); opacity: 0;   }
            100% { transform: scale(1);   opacity: 0;   }
          }
        </style>
      `;
      return L.divIcon({ html, className: "", iconSize: [0, 0], iconAnchor: [5, 5] });
    }

    if (isHovered) {
      const html = `
        <div style="position:relative; display:flex; align-items:center; justify-content:center; width:16px; height:16px;">
          <div style="
            width:10px; height:10px; border-radius:50%;
            background:#fff; border:2px solid rgba(255,255,255,0.4);
            box-shadow: 0 0 6px rgba(255,255,255,0.5);
          "></div>
          <div style="
            position:absolute; left:14px; top:50%; transform:translateY(-50%);
            background:rgba(0,0,0,0.9); border:1px solid rgba(255,255,255,0.12);
            padding:3px 8px; border-radius:6px; white-space:nowrap; pointer-events:none;
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
        background:rgba(255,255,255,0.35);
        border:1px solid rgba(255,255,255,0.2);
        transition:all 0.2s;
      "></div>
    `;
    return L.divIcon({ html, className: "", iconSize: [0, 0], iconAnchor: [3, 3] });
  };

  return (
    <div className="relative w-full h-full min-h-[550px] bg-[#050505]/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden group shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/5">
      {/* Border layers */}
      <div className="absolute inset-0 rounded-[2.5rem] border border-white/10 pointer-events-none z-30" />
      <div className="absolute inset-[2px] rounded-[2.5rem] border border-white/5 pointer-events-none z-30" />
      <div
        className="absolute inset-0 rounded-[2.5rem] pointer-events-none z-30 opacity-50"
        style={{
          boxShadow: `inset 0 0 40px ${getAQIColor(category)}22, 0 0 20px ${getAQIColor(category)}11`,
        }}
      />

      {/* Map */}
      <div className="absolute inset-0 z-10 opacity-80 contrast-125 brightness-110 saturate-150 grayscale-[0.3]">
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

      {/* Atmospheric glows */}
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-red-600/10 blur-[120px] pointer-events-none z-20" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-500/10 blur-[120px] pointer-events-none z-20" />

      <motion.div
        animate={{ opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none z-20"
      />

      <motion.div
        animate={{ y: ["0%", "100%", "0%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 w-full h-[2px] bg-white/[0.03] z-20 pointer-events-none blur-sm"
      />

      {/* Labels */}
      <div className="absolute top-4 left-6 z-20 pointer-events-none">
        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">
          Regional Matrix <span className="text-red-600 opacity-50">v4.0</span>
        </h3>
        <p className="text-white text-lg font-light tracking-widest mt-1 uppercase italic">
          India<span className="font-black non-italic">Network</span>
        </p>
      </div>

      <div className="absolute bottom-6 left-6 z-20 pointer-events-none flex flex-col gap-1">
        <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">
          LAT: {selectedCity.lat.toFixed(4)}° N
        </div>
        <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">
          LNG: {selectedCity.lng.toFixed(4)}° E
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-white/40 text-[10px] uppercase font-bold tracking-tighter">
            Live Sensor Feed
          </span>
        </div>
      </div>
    </div>
  );
}