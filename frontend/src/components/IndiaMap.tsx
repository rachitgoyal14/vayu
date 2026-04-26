/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { CITIES, City } from "../lib/cityData";
import { AQICategory, getAQIColor } from "../lib/aqiUtils";

interface IndiaMapProps {
  onCitySelect: (city: City) => void;
  selectedCityId: string;
  category: AQICategory;
}

// Component to handle map center changes smoothly
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 6, {
      duration: 1.5
    });
  }, [center, map]);
  return null;
}

export default function IndiaMap({ onCitySelect, selectedCityId, category }: IndiaMapProps) {
  const [hoveredCityId, setHoveredCityId] = useState<string | null>(null);
  
  const selectedCity = CITIES.find(c => c.id === selectedCityId) || CITIES[0];

  const createCustomIcon = (cityId: string, isSelected: boolean) => {
    const aqiColor = getAQIColor(category);
    const color = isSelected ? aqiColor : "rgba(255, 255, 255, 0.6)";
    const size = isSelected ? 18 : 8;
    const isHovered = hoveredCityId === cityId;
    
    const html = `
      <div class="relative flex items-center justify-center">
        ${(isSelected || isHovered) ? `
          <div class="absolute w-12 h-12 rounded-full animate-ping opacity-10" style="background-color: ${aqiColor}"></div>
          <div class="absolute w-8 h-8 rounded-full blur-md opacity-40" style="background-color: ${aqiColor}"></div>
        ` : ""}
        
        <div 
          class="rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all duration-500 flex items-center justify-center" 
          style="
            width: ${size}px; 
            height: ${size}px; 
            background-color: ${isHovered ? "#fff" : color};
            border: 2px solid ${isSelected ? "#fff" : "rgba(255,255,255,0.1)"};
            box-shadow: 0 0 15px ${isSelected ? aqiColor : "transparent"};
          "
        >
          ${isSelected ? `<div class="w-1.5 h-1.5 bg-black rounded-full"></div>` : ""}
        </div>

        ${(isHovered || isSelected) ? `
           <div class="absolute left-6 whitespace-nowrap bg-black/90 backdrop-blur-xl border border-white/20 px-4 py-2 rounded-xl shadow-2xl z-50">
              <div class="flex flex-col">
                <span class="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5">Sensor Node</span>
                <span class="text-[12px] font-black text-white uppercase tracking-widest">
                  ${CITIES.find(c => c.id === cityId)?.name}
                </span>
              </div>
           </div>
        ` : ""}
      </div>
    `;

    return L.divIcon({
      html,
      className: "custom-marker-icon",
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
  };

  return (
    <div 
      className="relative w-full h-full min-h-[550px] bg-[#050505]/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden group shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/5"
    >
      {/* 3D Hyper-Glowing Border System */}
      <div className="absolute inset-0 rounded-[2.5rem] border border-white/10 pointer-events-none z-30" />
      <div className="absolute inset-[2px] rounded-[2.5rem] border border-white/5 pointer-events-none z-30" />
      <div 
        className="absolute inset-0 rounded-[2.5rem] pointer-events-none z-30 opacity-50"
        style={{ 
          boxShadow: `inset 0 0 40px ${getAQIColor(category)}22, 0 0 20px ${getAQIColor(category)}11` 
        }}
      />
      
      {/* Map Container */}
      <div className="absolute inset-0 z-10 opacity-80 contrast-125 brightness-110 saturate-150 grayscale-[0.3]">
        <MapContainer 
          center={[selectedCity.lat, selectedCity.lng]} 
          zoom={5} 
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%", background: "#050505" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapController center={[selectedCity.lat, selectedCity.lng]} />
          
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

      {/* Atmospheric Tech Glows */}
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-red-600/10 blur-[120px] pointer-events-none z-20" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-500/10 blur-[120px] pointer-events-none z-20" />

      {/* Dynamic Background Accents */}
      <motion.div 
        animate={{ opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none z-20" 
      />
      
      {/* Diagnostic Scanline */}
      <motion.div 
        animate={{ y: ["0%", "100%", "0%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 w-full h-[2px] bg-white/[0.03] z-20 pointer-events-none blur-sm" 
      />

      {/* Cyber-Grid Corner Readouts */}
      <div className="absolute top-4 left-6 z-20 pointer-events-none">
        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Regional Matrix <span className="text-red-600 opacity-50">v4.0</span></h3>
        <p className="text-white text-lg font-light tracking-widest mt-1 uppercase italic">India<span className="font-black non-italic">Network</span></p>
      </div>

      <div className="absolute bottom-6 left-6 z-20 pointer-events-none flex flex-col gap-1">
        <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">LAT: {selectedCity.lat.toFixed(4)}° N</div>
        <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">LNG: {selectedCity.lng.toFixed(4)}° E</div>
      </div>

      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-white/40 text-[10px] uppercase font-bold tracking-tighter">Live Sensor Feed</span>
        </div>
      </div>
    </div>
  );
}
