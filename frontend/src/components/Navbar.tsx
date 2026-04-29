/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Search, MapPin, Wind } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { CITIES, City } from "../lib/cityData";
import { motion, AnimatePresence } from "motion/react";

interface NavbarProps {
  onCitySelect: (city: City) => void;
  selectedCity: City;
}

// Haversine distance in km between two lat/lng points
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest city in CITIES[] to a given lat/lng
function nearestCity(lat: number, lng: number): City {
  return CITIES.reduce((best, city) => {
    const d = haversineKm(lat, lng, city.lat, city.lng);
    const bd = haversineKm(lat, lng, best.lat, best.lng);
    return d < bd ? city : best;
  });
}

// Geocode a free-text query via OpenStreetMap Nominatim (India-biased)
async function geocodeIndia(query: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const params = new URLSearchParams({
      q: `${query}, India`,
      format: "json",
      limit: "1",
      countrycodes: "in",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch {
    return null;
  }
}

interface Suggestion {
  city: City;
  label: string;
  sublabel: string;
  distance?: number;
}

// How long (ms) the user must stop typing before a geocode request fires.
// Long enough that mid-word keystrokes never trigger a lookup, short enough
// that the result appears quickly after they finish typing.
const GEOCODE_DEBOUNCE_MS = 600;

export default function Navbar({ onCitySelect, selectedCity }: NavbarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [geocodeSuggestions, setGeocodeSuggestions] = useState<Suggestion[]>([]);
  const [geocoding, setGeocoding] = useState(false);

  // Ref to hold the debounce timer so we can cancel it on every keystroke.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Direct name matches (synchronous, instant)
  const directSuggestions = useMemo<Suggestion[]>(() => {
    const q = query.toLowerCase().trim();
    if (q.length < 2) return [];
    return CITIES.filter((c) => c.name.toLowerCase().includes(q)).map((city) => ({
      city,
      label: city.name,
      sublabel: "Direct sensor node",
    }));
  }, [query]);

  // Merge direct + geocode, deduplicate by city id
  const suggestions = useMemo<Suggestion[]>(() => {
    const seen = new Set(directSuggestions.map((s) => s.city.id));
    const extras = geocodeSuggestions.filter((s) => !seen.has(s.city.id));
    return [...directSuggestions, ...extras].slice(0, 8);
  }, [directSuggestions, geocodeSuggestions]);

  // Geocode effect — fires only after the user stops typing for GEOCODE_DEBOUNCE_MS.
  // This prevents intermediate partial words like "pat" (mid-"patiala") from
  // geocoding to the wrong location entirely.
  useEffect(() => {
    const q = query.trim();

    // Clear stale geocode results whenever the query changes so they don't
    // linger while the user is still typing.
    setGeocodeSuggestions([]);

    // Don't geocode if query is too short or a direct match already exists.
    if (q.length < 3) {
      setGeocoding(false);
      return;
    }

    const hasDirectMatch = CITIES.some((c) =>
      c.name.toLowerCase().includes(q.toLowerCase()),
    );
    if (hasDirectMatch) {
      setGeocoding(false);
      return;
    }

    // Cancel any pending geocode from a previous keystroke.
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Schedule the geocode — it will only run if the user has paused typing.
    debounceTimer.current = setTimeout(async () => {
      setGeocoding(true);
      const geo = await geocodeIndia(q);
      setGeocoding(false);

      if (!geo) return;

      const nearest = nearestCity(geo.lat, geo.lng);
      const dist = Math.round(haversineKm(geo.lat, geo.lng, nearest.lat, nearest.lng));

      setGeocodeSuggestions([
        {
          city: nearest,
          label: nearest.name,
          sublabel: `Nearest node to "${q}" (~${dist} km)`,
          distance: dist,
        },
      ]);
    }, GEOCODE_DEBOUNCE_MS);

    // Clean up if query changes before the timer fires.
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] h-20 px-8 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-3xl transition-all">
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="relative group">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_25px_rgba(220,38,38,0.7)] group-hover:scale-110 transition-transform duration-500">
            <Wind className="w-6 h-6 text-white" />
          </div>
          <div className="absolute inset-0 bg-red-600 blur-xl opacity-20 -z-1" />
        </div>
        <div className="hidden sm:block">
          <h1 className="text-xl font-black tracking-[0.25em] uppercase text-white">Vayu</h1>
          <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.5em] -mt-1 opacity-70">
            Neural Matrix Dashboard
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-3xl px-8 group">
        <div className={`relative flex items-center transition-all duration-700 ${isFocused ? "scale-[1.015]" : ""}`}>
          <Search
            className={`absolute left-6 w-4 h-4 transition-colors duration-500 ${
              isFocused ? "text-red-500" : "text-slate-500"
            }`}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="Search any city — nearest sensor node auto-resolved..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-full py-4 pl-14 pr-6 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-red-600/10 focus:border-red-600/30 transition-all font-bold tracking-tight shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          />
          {isFocused && (
            <div className="absolute right-6 flex items-center gap-2">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest animate-pulse">
                {geocoding ? "Resolving Location..." : "Scanning Grid"}
              </span>
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
                {suggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.city.id}-${suggestion.sublabel}`}
                    onClick={() => {
                      onCitySelect(suggestion.city);
                      setQuery("");
                      setGeocodeSuggestions([]);
                    }}
                    className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-white/[0.04] transition-all group/item rounded-3xl"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover/item:bg-red-600/20 group-hover/item:rotate-12 transition-all duration-500">
                        <MapPin className="w-5 h-5 text-slate-500 group-hover/item:text-red-500 transition-colors" />
                      </div>
                      <div>
                        <p className="text-slate-100 font-bold text-base uppercase tracking-widest group-hover/item:text-white transition-colors">
                          {suggestion.label}
                        </p>
                        <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest mt-1.5 opacity-60">
                          {suggestion.sublabel}
                        </p>
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

      {/* Status */}
      <div className="hidden lg:flex items-center gap-8">
        <div className="text-right">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] opacity-60">
            Active Intelligence
          </p>
          <p className="text-sm font-black text-white uppercase tracking-tight">
            {selectedCity.name} Matrix
          </p>
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