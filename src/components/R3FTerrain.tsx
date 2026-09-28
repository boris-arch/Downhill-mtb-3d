import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { GeneratedTrail } from '../game/trailGenerator';

interface R3FTerrainProps {
  trail: GeneratedTrail;
  terrainGeom?: THREE.BufferGeometry;
  terrainMat?: THREE.Material;
}

/**
 * R3FTerrain Component
 * Declarative React Three Fiber component representing the procedural alpine mountain terrain.
 * Renders the terrain mesh with vertex colors, shadows, and optimized buffer geometry.
 */
export const R3FTerrain: React.FC<R3FTerrainProps> = ({ trail, terrainGeom, terrainMat }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Use provided geometry/material or fallback to trail's precomputed terrain
  const geometry = useMemo(() => {
    return terrainGeom || trail.terrainMesh.geometry;
  }, [terrainGeom, trail]);

  const material = useMemo(() => {
    return terrainMat || trail.terrainMesh.material;
  }, [terrainMat, trail]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      receiveShadow
      castShadow={false}
    />
  );
};
