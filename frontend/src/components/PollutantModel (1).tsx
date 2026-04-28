/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Float } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { motion } from "motion/react";
import { AQICategory, getAQIColor } from "../lib/aqiUtils";

interface PollutantModelProps {
  category: AQICategory;
  isLoading?: boolean;
}

function Molecule({ color }: { color: string }) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = state.clock.getElapsedTime() * 0.2;
      mesh.current.rotation.y = state.clock.getElapsedTime() * 0.3;
    }
  });

  return (
    <group>
      <Float speed={2} rotationIntensity={1} floatIntensity={1}>
        <Sphere ref={mesh} args={[1, 64, 64]}>
          <MeshDistortMaterial
            color={color}
            speed={2}
            distort={0.4}
            radius={1}
            emissive={color}
            emissiveIntensity={0.5}
            transparent
            opacity={0.8}
          />
        </Sphere>
      </Float>

      {[...Array(5)].map((_, i) => (
        <Float key={i} speed={3} rotationIntensity={2} floatIntensity={2}>
          <Sphere
            args={[0.1, 16, 16]}
            position={[Math.sin(i) * 2, Math.cos(i) * 2, Math.sin(i * 1.5) * 2]}
          >
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
          </Sphere>
        </Float>
      ))}
    </group>
  );
}

/* ─── Loading Skeleton ──────────────────────────────────────────────────── */
function PollutantModelSkeleton() {
  return (
    <div className="w-full h-full min-h-[300px] flex items-center justify-center relative overflow-hidden">
      {/* Ambient scan lines */}
      <motion.div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.12) 2px, rgba(255,255,255,0.12) 4px)",
        }}
        animate={{ backgroundPositionY: ["0px", "80px"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
      />

      {/* Outer orbit ring */}
      <motion.div
        className="absolute w-52 h-52 rounded-full border border-dashed border-slate-700/50"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      />

      {/* Inner orbit ring — counter-rotates */}
      <motion.div
        className="absolute w-32 h-32 rounded-full border border-dashed border-slate-800/60"
        animate={{ rotate: [0, -360] }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
      />

      {/* Central blob — pulsing sphere stand-in */}
      <motion.div
        className="relative w-20 h-20 rounded-full bg-slate-800/60 border border-slate-700/30"
        animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ boxShadow: "0 0 40px rgba(148,163,184,0.08)" }}
      >
        {/* Inner shimmer */}
        <motion.div
          className="absolute inset-2 rounded-full bg-slate-700/40"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />
      </motion.div>

      {/* Orbiting electron dots — fixed positions so they don't re-randomise */}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-slate-600/70"
          style={{
            // evenly spaced on the outer ring radius (~104px)
            top: `calc(50% + ${Math.sin((i / 5) * Math.PI * 2) * 104}px - 4px)`,
            left: `calc(50% + ${Math.cos((i / 5) * Math.PI * 2) * 104}px - 4px)`,
          }}
          animate={{ opacity: [0.2, 0.7, 0.2], scale: [0.8, 1.3, 0.8] }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: (i / 5) * 2.2,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function PollutantModel({ category, isLoading = false }: PollutantModelProps) {
  const color = useMemo(() => getAQIColor(category), [category]);

  if (isLoading) {
    return <PollutantModelSkeleton />;
  }

  return (
    <div className="w-full h-full min-h-[300px] cursor-grab active:cursor-grabbing">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color={color} />
        <spotLight position={[-10, -10, -10]} intensity={0.5} color={color} />
        <Molecule color={color} />
      </Canvas>
    </div>
  );
}
