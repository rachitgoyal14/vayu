/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence, type TargetAndTransition, type Transition } from "motion/react";
import { AQICategory, getAQIColor } from "../lib/aqiUtils";

interface AQIMascotProps {
  category: AQICategory;
}

// Per-category config: emoji, label, animation style
const CATEGORY_CONFIG: Record<
  AQICategory,
  {
    emoji: string;
    label: string;
    animate: TargetAndTransition;
    transition: Transition;
    pulseColor: string;
  }
> = {
  Good: {
    emoji: "🌿",
    label: "Fresh Air",
    animate: { y: [0, -8, 0], rotate: [0, 2, -2, 0] },
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    pulseColor: "#22c55e",
  },
  Satisfactory: {
    emoji: "🙂",
    label: "Acceptable",
    animate: { y: [0, -5, 0], scale: [1, 1.03, 1] },
    transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
    pulseColor: "#84cc16",
  },
  Moderate: {
    emoji: "😶‍🌫️",
    label: "Hazy",
    animate: { x: [0, 3, -3, 0], opacity: [1, 0.8, 1] },
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
    pulseColor: "#f59e0b",
  },
  Poor: {
    emoji: "😷",
    label: "Mask Up",
    animate: { scale: [1, 1.06, 1], rotate: [0, -3, 3, 0] },
    transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
    pulseColor: "#f97316",
  },
  "Very Poor": {
    emoji: "🤧",
    label: "Dangerous",
    animate: { y: [0, -4, 4, 0], x: [0, 2, -2, 0], rotate: [0, 5, -5, 0] },
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
    pulseColor: "#ef4444",
  },
  Severe: {
    emoji: "☠️",
    label: "Hazardous",
    animate: {
      scale: [1, 1.1, 0.95, 1.05, 1],
      rotate: [0, -8, 8, -4, 0],
      filter: ["brightness(1)", "brightness(1.3)", "brightness(0.8)", "brightness(1)"],
    },
    transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
    pulseColor: "#7c3aed",
  },
};

export default function AQIMascot({ category }: AQIMascotProps) {
  const color = getAQIColor(category);
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG["Moderate"];

  return (
    <div className="relative w-64 h-64 flex items-center justify-center p-4">
      {/* Background Atmosphere Glow */}
      <motion.div
        className="absolute w-44 h-44 rounded-full blur-[70px]"
        animate={{ opacity: [0.15, 0.3, 0.15], scale: [1, 1.1, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ backgroundColor: color }}
      />

      {/* Outer dashed ring — spins slowly */}
      <motion.div
        className="absolute inset-6 rounded-full border border-dashed opacity-20"
        style={{ borderColor: color }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* Inner counter-spin ring */}
      <motion.div
        className="absolute rounded-full border opacity-10"
        style={{ inset: "28px", borderColor: color }}
        animate={{ rotate: [0, -360] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />

{/* Orbiting dot */}
      <motion.div
        className="absolute"
        style={{ top: "24px", left: "50%", marginLeft: "-4px", transformOrigin: "center 104px" }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
      </motion.div>

      {/* Emoji Container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={category}
          className="relative z-10 text-[80px] drop-shadow-[0_0_30px_rgba(0,0,0,0.5)] select-none"
          initial={{ scale: 0.5, opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ scale: 1, opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ scale: 0.5, opacity: 0, y: -20, filter: "blur(8px)" }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          {/* Idle animation wrapper */}
          <motion.span
            animate={config.animate}
            transition={config.transition}
          >
            {config.emoji}
          </motion.span>
        </motion.div>
      </AnimatePresence>

      {/* Category label badge */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`label-${category}`}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap border"
          style={{
            color,
            borderColor: `${color}44`,
            backgroundColor: `${color}15`,
          }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.4 }}
        >
          {config.label}
        </motion.div>
      </AnimatePresence>

      {/* Decorative outer ring */}
      <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none" />
    </div>
  );
}