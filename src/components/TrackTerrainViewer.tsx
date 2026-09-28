import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TrackData } from '../types/game';
import { generateTrail } from '../game/trailGenerator';
import { R3FTerrain } from './R3FTerrain';

interface TrackTerrainViewerProps {
  track: TrackData;
}

const RotatingMountain: React.FC<{ track: TrackData }> = ({ track }) => {
  const groupRef = useRef<THREE.Group>(null);
  const trail = React.useMemo(() => generateTrail(track), [track]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.25;
    }
  });

  return (
    <group ref={groupRef} position={[0, -20, 0]} scale={[0.12, 0.12, 0.12]}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[60, 100, 50]} intensity={1.5} castShadow />
      <R3FTerrain trail={trail} />
    </group>
  );
};

export const TrackTerrainViewer: React.FC<TrackTerrainViewerProps> = ({ track }) => {
  return (
    <div className="w-full h-28 rounded-xl overflow-hidden bg-slate-950/60 border border-slate-800/80 mb-3 relative">
      <Canvas
        camera={{ position: [0, 45, 95], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <RotatingMountain track={track} />
      </Canvas>
      <div className="absolute top-1.5 right-2 text-[9px] font-mono font-bold text-orange-400/80 uppercase tracking-widest pointer-events-none">
        R3F 3D Topography
      </div>
    </div>
  );
};
