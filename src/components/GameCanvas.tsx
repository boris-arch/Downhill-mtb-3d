import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { BikeCustomization, CameraView, TelemetryData, TrackData } from '../types/game';
import { generateTrail, GeneratedTrail } from '../game/trailGenerator';
import { createBikeModel, BikeMeshSystem } from '../game/bikeModel';
import { MTBPhysics, PlayerControls } from '../game/physicsEngine';
import { createMountainAtmosphere } from '../game/mountainAtmosphere';

interface GameCanvasProps {
  trackData: TrackData;
  bikeConfig: BikeCustomization;
  cameraView: CameraView;
  isPaused: boolean;
  onUpdateTelemetry: (telemetry: TelemetryData) => void;
  onFinishRun: () => void;
  physicsRef: React.MutableRefObject<MTBPhysics | null>;
  controlsRef: React.MutableRefObject<PlayerControls>;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  trackData,
  bikeConfig,
  cameraView,
  isPaused,
  onUpdateTelemetry,
  onFinishRun,
  physicsRef,
  controlsRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bikeMeshRef = useRef<BikeMeshSystem | null>(null);
  const trailRef = useRef<GeneratedTrail | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(trackData.skyColor);
    scene.fog = new THREE.Fog(trackData.fogColor, 90, 720);

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.05, 1600);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xe8eef5, 0.72);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(trackData.sunColor, 1.65);
    sunLight.position.set(80, 170, 70);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 8;
    sunLight.shadow.camera.far = 560;
    sunLight.shadow.camera.left = -110;
    sunLight.shadow.camera.right = 110;
    sunLight.shadow.camera.top = 110;
    sunLight.shadow.camera.bottom = -110;
    sunLight.shadow.bias = -0.00015;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);
    scene.add(new THREE.HemisphereLight(trackData.skyColor, trackData.groundColor, 0.58));

    const atmosphere = createMountainAtmosphere(trackData.skyColor, trackData.fogColor, trackData.sunColor);
    scene.add(atmosphere);

    const trail = generateTrail(trackData);
    trailRef.current = trail;
    scene.add(trail.terrainMesh, trail.trailMesh, trail.sceneryGroup);
    trail.terrainMesh.castShadow = false;
    trail.terrainMesh.receiveShadow = true;
    trail.trailMesh.receiveShadow = true;

    const bikeSystem = createBikeModel(bikeConfig);
    bikeMeshRef.current = bikeSystem;
    scene.add(bikeSystem.rootGroup);

    const dustCount = 500;
    const dustGeom = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    const dustVelocities = new Float32Array(dustCount * 3);
    const dustLifetimes = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) dustPositions[i * 3 + 1] = -500;
    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xc6a982,
      size: 0.28,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const dustParticles = new THREE.Points(dustGeom, dustMat);
    scene.add(dustParticles);

    if (!physicsRef.current) physicsRef.current = new MTBPhysics();
    physicsRef.current.reset(trail);
    const physics = physicsRef.current;
    physics.updateBikeAndCamera(bikeSystem.rootGroup, trail, camera, cameraView, 0.016);

    const handleResize = () => {
      if (!container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let animationFrameId = 0;
    let lastTime = performance.now();
    let dustSpawnIndex = 0;
    const clouds = (atmosphere.userData.clouds as THREE.Mesh[] | undefined) ?? [];

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const deltaSeconds = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;
      clouds.forEach((cloud, index) => {
        cloud.position.x += deltaSeconds * (0.7 + index % 3 * 0.18);
        cloud.rotation.y += deltaSeconds * 0.008;
        if (cloud.position.x > 760) cloud.position.x = -760;
      });

      if (!isPaused && trailRef.current) {
        physics.update(deltaSeconds, controlsRef.current, bikeConfig, trailRef.current);
        physics.updateBikeAndCamera(bikeSystem.rootGroup, trailRef.current, camera, cameraView, deltaSeconds);
        const currentAlt = trailRef.current.getPointAtDistance(physics.trackDistance).position.y;
        bikeSystem.updateTransforms(physics.steerAngle, physics.frontSuspensionCompression, physics.rearSuspensionCompression, physics.wheelRotation, physics.brakePressure, physics.pedalAngle, physics.speed * 3.6, currentAlt, physics.currentGear, physics.frontBrakePressure);

        sunLight.position.set(bikeSystem.rootGroup.position.x + 40, bikeSystem.rootGroup.position.y + 120, bikeSystem.rootGroup.position.z + 35);
        sunLight.target.position.copy(bikeSystem.rootGroup.position);
        sunLight.target.updateMatrixWorld();

        if (physics.isGrounded && (physics.speed > 5 || physics.isSkidding)) {
          const rearTirePos = bikeSystem.rootGroup.position.clone().add(new THREE.Vector3(0, -0.28, 0.62).applyQuaternion(bikeSystem.rootGroup.quaternion));
          const count = physics.isSkidding ? 5 : 2;
          for (let p = 0; p < count; p++) {
            dustSpawnIndex = (dustSpawnIndex + 1) % dustCount;
            dustPositions[dustSpawnIndex * 3] = rearTirePos.x + (Math.random() - 0.5) * 0.22;
            dustPositions[dustSpawnIndex * 3 + 1] = rearTirePos.y + Math.random() * 0.12;
            dustPositions[dustSpawnIndex * 3 + 2] = rearTirePos.z + (Math.random() - 0.5) * 0.22;
            dustVelocities[dustSpawnIndex * 3] = (Math.random() - 0.5) * 1.6;
            dustVelocities[dustSpawnIndex * 3 + 1] = 0.5 + Math.random() * 2.2;
            dustVelocities[dustSpawnIndex * 3 + 2] = 2 + Math.random() * physics.speed * 0.4;
            dustLifetimes[dustSpawnIndex] = 1;
          }
        }
        for (let i = 0; i < dustCount; i++) {
          if (dustLifetimes[i] > 0) {
            dustLifetimes[i] -= deltaSeconds * 1.8;
            dustPositions[i * 3] += dustVelocities[i * 3] * deltaSeconds;
            dustPositions[i * 3 + 1] += dustVelocities[i * 3 + 1] * deltaSeconds;
            dustPositions[i * 3 + 2] += dustVelocities[i * 3 + 2] * deltaSeconds;
            dustVelocities[i * 3 + 1] -= 4 * deltaSeconds;
          } else dustPositions[i * 3 + 1] = -500;
        }
        dustGeom.attributes.position.needsUpdate = true;
        onUpdateTelemetry(physics.getTelemetry(trailRef.current));
        if (physics.trackDistance >= trailRef.current.totalLength - 10) onFinishRun();
      }
      renderer.render(scene, camera);
    };
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      dustGeom.dispose();
      dustMat.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((mat) => mat.dispose());
          else material.dispose();
        }
      });
    };
  }, [trackData, cameraView]);

  useEffect(() => {
    if (bikeMeshRef.current) bikeMeshRef.current.updateMaterials(bikeConfig);
  }, [bikeConfig]);

  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const handlePointerDown = (e: React.PointerEvent) => { isPointerDownRef.current = true; startXRef.current = e.clientX; };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    controlsRef.current.steerLeft = deltaX < -20;
    controlsRef.current.steerRight = deltaX > 20;
  };
  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    controlsRef.current.steerLeft = false;
    controlsRef.current.steerRight = false;
  };

  return <div ref={containerRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} className="w-full h-full relative cursor-crosshair overflow-hidden touch-none select-none" />;
};
