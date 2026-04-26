/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Cloud, Float, Stars, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { AQICategory, getAQIColor } from "../lib/aqiUtils";

interface AtmosphereProps {
  category: AQICategory;
}

function Clouds({ color }: { color: string }) {
  const group = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group ref={group}>
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
        <Cloud
          opacity={0.4}
          speed={0.4}
          segments={20}
          color={color}
          position={[-4, 2, -5]}
        />
      </Float>
      <Float speed={1} rotationIntensity={0.5} floatIntensity={0.5}>
        <Cloud
          opacity={0.4}
          speed={0.4}
          segments={20}
          color={color}
          position={[4, -2, -5]}
        />
      </Float>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <Cloud
          opacity={0.2}
          speed={0.4}
          segments={40}
          color={color}
          position={[0, 0, -10]}
        />
      </Float>
    </group>
  );
}

export default function Atmosphere({ category }: AtmosphereProps) {
  const color = useMemo(() => getAQIColor(category), [category]);

  return (
    <div className="fixed inset-0 -z-10 bg-[#0A0606] overflow-hidden">
      {/* Cinematic Blur Layers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse transition-colors duration-2000 opacity-40"
          style={{ backgroundColor: `${color}66` }}
        />
        <div 
          className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[100px] transition-colors duration-2000 opacity-20"
          style={{ backgroundColor: `${color}44` }}
        />
        {/* Dot Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-10" 
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '40px 40px' }}
        />
        {/* Moving Haze layer from Design */}
        <div 
          className="absolute top-1/4 -left-1/4 w-[150%] h-[50%] blur-3xl opacity-30 transform rotate-12 animate-cloud-slow transition-colors duration-1000"
          style={{ background: `linear-gradient(to right, transparent, ${color}22, transparent)` }}
        />
      </div>

      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color={color} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} color={color} />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <Clouds color={color} />
        
        <fog attach="fog" args={["#0A0606", 5, 15]} />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0606]/30 to-[#0A0606] pointer-events-none" />
    </div>
  );
}
