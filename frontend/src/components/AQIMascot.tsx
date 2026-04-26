/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { AQICategory, getAQIColor } from "../lib/aqiUtils";

interface AQIMascotProps {
  category: AQICategory;
}

export default function AQIMascot({ category }: AQIMascotProps) {
  const color = getAQIColor(category);

  const getEmoji = () => {
    switch (category) {
      case "Good":
        return "😇";
      case "Moderate":
        return "😐";
      case "Poor":
        return "😷";
      case "Unhealthy":
        return "🤢";
      case "Severe":
        return "🚨";
      case "Hazardous":
        return "💀";
      default:
        return "😐";
    }
  };

  return (
    <div className="relative w-64 h-64 flex items-center justify-center p-4">
      {/* Background Atmosphere Glow - Constant and Static */}
      <div
        className="absolute w-44 h-44 rounded-full blur-[70px] opacity-20"
        style={{ backgroundColor: color }}
      />
      
      {/* Rotating Background Ring - Very faint and slow */}
      <div className="absolute inset-8 rounded-full border border-dashed border-white/5 animate-spin-slow opacity-20" />
      
      {/* Emoji Container - Static Display */}
      <motion.div 
        className="relative z-10 text-[80px] drop-shadow-[0_0_30px_rgba(0,0,0,0.5)] select-none"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        key={category}
        transition={{ type: "spring", stiffness: 150, damping: 25 }}
      >
        {getEmoji()}
      </motion.div>

      {/* Decorative Technical Ring */}
      <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none" />
    </div>
  );
}

