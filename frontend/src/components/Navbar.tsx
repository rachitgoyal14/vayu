/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Search, MapPin, Wind } from "lucide-react";
import { useState, useMemo } from "react";
import { CITIES, City } from "../lib/cityData";
import { motion, AnimatePresence } from "motion/react";

interface NavbarProps {
  onCitySelect: (city: City) => void;
  selectedCity: City;
}

// Haversine distance formula to find the nearest city node
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Map common area names that don't have major sensors to the nearest station
const PROXIMITY_MAPPINGS: Record<string, { lat: number, lng: number }> = {
  "mohali": { lat: 30.7046, lng: 76.7179 },
  "noida": { lat: 28.5355, lng: 77.3910 },
  "ghaziabad": { lat: 28.6692, lng: 77.4538 },
  "thane": { lat: 19.2183, lng: 72.9781 },
  "howrah": { lat: 22.5958, lng: 88.2636 },
  "secunderabad": { lat: 17.4399, lng: 78.4983 },
  "gurgaon": { lat: 28.4595, lng: 77.0266 },
  "navi mumbai": { lat: 19.0330, lng: 73.0297 },
  "panchkula": { lat: 30.6942, lng: 76.8606 },
};

export default function Navbar({ onCitySelect, selectedCity }: NavbarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const suggestions = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    if (normalizedQuery.length < 2) return [];
    
    // 1. Direct city name matches
    const directMatches = CITIES.filter(c => 
      c.name.toLowerCase().includes(normalizedQuery)
    );

    // 2. Proximity resolution for satellite regions
    let resolvedCity: City | null = null;
    const proximityMatch = PROXIMITY_MAPPINGS[normalizedQuery];
    
    if (proximityMatch) {
      const nearest = CITIES.reduce((prev, curr) => {
        const distPrev = getDistance(proximityMatch.lat, proximityMatch.lng, prev.lat, prev.lng);
        const distCurr = getDistance(proximityMatch.lat, proximityMatch.lng, curr.lat, curr.lng);
        return distCurr < distPrev ? curr : prev;
      });
      resolvedCity = { ...nearest, name: `${query.charAt(0).toUpperCase() + query.slice(1)} (Proximal to ${nearest.name})` };
    }

    const results = [...directMatches];
    if (resolvedCity && !results.find(r => r.id === resolvedCity?.id)) {
      results.push(resolvedCity);
    }

    return results.slice(0, 8);
  }, [query]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] h-20 px-8 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-3xl transition-all">
      {/* Cinematic Logo */}
      <div className="flex items-center gap-4">
        <div className="relative group">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_25px_rgba(220,38,38,0.7)] group-hover:scale-110 transition-transform duration-500">
            <Wind className="w-6 h-6 text-white" />
          </div>
          <div className="absolute inset-0 bg-red-600 blur-xl opacity-20 -z-1" />
        </div>
        <div className="hidden sm:block">
          <h1 className="text-xl font-black tracking-[0.25em] uppercase text-white">Vayu</h1>
          <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.5em] -mt-1 opacity-70">Neural Matrix Dashboard</p>
        </div>
      </div>

      {/* Elongated Smart Proximity Search Bar */}
      <div className="relative w-full max-w-3xl px-8 group">
        <div className={`relative flex items-center transition-all duration-700 ${isFocused ? 'scale-[1.015]' : ''}`}>
          <Search className={`absolute left-6 w-4 h-4 transition-colors duration-500 ${isFocused ? 'text-red-500' : 'text-slate-500'}`} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="Search city node (e.g. Mohali, Noida, Thane)..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-full py-4 pl-14 pr-6 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-red-600/10 focus:border-red-600/30 transition-all font-bold tracking-tight shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          />
          {isFocused && (
             <div className="absolute right-6 flex items-center gap-2">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Scanning Grid</span>
             </div>
          )}
        </div>

        <AnimatePresence>
          {isFocused && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 15 }}
              className="absolute top-full left-8 right-8 mt-5 bg-[#080808]/98 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.95)] z-[120]"
            >
              <div className="p-4">
                {suggestions.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => {
                      onCitySelect(city);
                      setQuery("");
                    }}
                    className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/[0.04] transition-all group/item rounded-3xl"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover/item:bg-red-600/20 group-hover/item:rotate-12 transition-all duration-500">
                        <MapPin className="w-5 h-5 text-slate-500 group-hover/item:text-red-500 transition-colors" />
                      </div>
                      <div>
                        <p className="text-slate-100 font-bold text-base uppercase tracking-widest group-hover/item:text-white transition-colors">{city.name}</p>
                        <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest mt-1.5 opacity-60">Connected to Neural Grid v4</p>
                      </div>
                    </div>
                    <div className="px-5 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover/item:bg-red-600/10 group-hover/item:text-red-500 group-hover/item:border-red-600/30 transition-all">
                       Initialize Focus
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active System Status */}
      <div className="hidden lg:flex items-center gap-8">
        <div className="text-right">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] opacity-60">Active Intelligence</p>
           <p className="text-sm font-black text-white uppercase tracking-tight">{selectedCity.name} Matrix</p>
        </div>
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center group cursor-pointer hover:border-red-600/40 transition-all duration-500">
             <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping absolute opacity-50" />
             <div className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,1)]" />
          </div>
        </div>
      </div>
    </nav>
  );
}
