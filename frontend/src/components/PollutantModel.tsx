/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Float } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { AQICategory, getAQIColor } from "../lib/aqiUtils";

interface PollutantModelProps {
  category: AQICategory;
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
      
      {/* Smaller "electrons" or particles */}
      {[...Array(5)].map((_, i) => (
        <Float key={i} speed={3} rotationIntensity={2} floatIntensity={2}>
           <Sphere args={[0.1, 16, 16]} position={[Math.sin(i) * 2, Math.cos(i) * 2, Math.sin(i * 1.5) * 2]}>
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
           </Sphere>
        </Float>
      ))}
    </group>
  );
}

export default function PollutantModel({ category }: PollutantModelProps) {
  const color = useMemo(() => getAQIColor(category), [category]);

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
