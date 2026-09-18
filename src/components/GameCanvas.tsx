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

    // 1. Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(trackData.skyColor);
    scene.fog = new THREE.FogExp2(trackData.fogColor, 0.0035);

    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.02,
      1200
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 2. Lighting (Sunlight + Ambient Skylight + Fill Light)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(trackData.sunColor, 1.4);
    sunLight.position.set(60, 150, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(trackData.skyColor, trackData.groundColor, 0.45);
    scene.add(hemiLight);

    // Dynamic Alpine Atmosphere (Atmospheric Dome, Sun Disc, Mountain Clouds)
    const atmosphere = createMountainAtmosphere(trackData.skyColor, trackData.fogColor, trackData.sunColor);
    scene.add(atmosphere);

    // 3. Generate Downhill Trail & Mountain
    const trail = generateTrail(trackData);
    trailRef.current = trail;
    scene.add(trail.trailMesh);
    scene.add(trail.terrainMesh);
    scene.add(trail.sceneryGroup);

    // 4. Build 3D Mountain Bike
    const bikeSystem = createBikeModel(bikeConfig);
    bikeMeshRef.current = bikeSystem;
    scene.add(bikeSystem.rootGroup);

    // 5. Dirt Dust Particle System (Roost thrown by knobby tires)
    const dustCount = 350;
    const dustGeom = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    const dustVelocities = new Float32Array(dustCount * 3);
    const dustLifetimes = new Float32Array(dustCount);

    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = 0;
      dustPositions[i * 3 + 1] = -500;
      dustPositions[i * 3 + 2] = 0;
      dustLifetimes[i] = 0;
    }

    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xc2a688,
      size: 0.35,
      transparent: true,
      opacity: 0.55,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const dustParticles = new THREE.Points(dustGeom, dustMat);
    scene.add(dustParticles);

    // 6. Physics initialization
    if (!physicsRef.current) {
      physicsRef.current = new MTBPhysics();
    }
    physicsRef.current.reset(trail);
    const physics = physicsRef.current;

    // Immediately orient bike and camera down the initial run line at distance 0
    physics.updateBikeAndCamera(bikeSystem.rootGroup, trail, camera, cameraView, 0.016);

    // 7. Resize Observer
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 8. Animation & Simulation Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    let dustSpawnIndex = 0;

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const deltaSeconds = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      if (!isPaused && physics && trailRef.current) {
        // Step physics simulation
        physics.update(deltaSeconds, controlsRef.current, bikeConfig, trailRef.current);

        // Update bike mesh matrix and camera orientation
        physics.updateBikeAndCamera(bikeSystem.rootGroup, trailRef.current, camera, cameraView, deltaSeconds);

        // Animate bike components (fork stanchion travel, rear shock, wheels, handlebars, progressive brake levers)
        const currentAlt = trailRef.current.getPointAtDistance(physics.trackDistance).position.y;
        bikeSystem.updateTransforms(
          physics.steerAngle,
          physics.frontSuspensionCompression,
          physics.rearSuspensionCompression,
          physics.wheelRotation,
          physics.brakePressure,
          physics.pedalAngle,
          physics.speed * 3.6,
          currentAlt,
          physics.currentGear,
          physics.frontBrakePressure
        );

        // Follow sunlight with rider to keep crisp shadows along downhill run
        sunLight.position.set(
          bikeSystem.rootGroup.position.x + 40,
          bikeSystem.rootGroup.position.y + 110,
          bikeSystem.rootGroup.position.z + 35
        );
        sunLight.target.position.copy(bikeSystem.rootGroup.position);
        sunLight.target.updateMatrixWorld();

        // Spawn roost dust particles from rear tire
        if (physics.isGrounded && (physics.speed > 5 || physics.isSkidding)) {
          const rearTirePos = bikeSystem.rootGroup.position.clone()
            .add(new THREE.Vector3(0, -0.28, 0.62).applyQuaternion(bikeSystem.rootGroup.quaternion));

          const numParticles = physics.isSkidding ? 4 : 2;
          for (let p = 0; p < numParticles; p++) {
            dustSpawnIndex = (dustSpawnIndex + 1) % dustCount;
            dustPositions[dustSpawnIndex * 3] = rearTirePos.x + (Math.random() - 0.5) * 0.2;
            dustPositions[dustSpawnIndex * 3 + 1] = rearTirePos.y + Math.random() * 0.1;
            dustPositions[dustSpawnIndex * 3 + 2] = rearTirePos.z + (Math.random() - 0.5) * 0.2;

            // Fling backward and slightly upward
            dustVelocities[dustSpawnIndex * 3] = (Math.random() - 0.5) * 1.5;
            dustVelocities[dustSpawnIndex * 3 + 1] = 0.5 + Math.random() * 2.2;
            dustVelocities[dustSpawnIndex * 3 + 2] = 2.0 + Math.random() * (physics.speed * 0.4);
            dustLifetimes[dustSpawnIndex] = 1.0;
          }
        }

        // Update active dust particles
        for (let i = 0; i < dustCount; i++) {
          if (dustLifetimes[i] > 0) {
            dustLifetimes[i] -= deltaSeconds * 1.8;
            dustPositions[i * 3] += dustVelocities[i * 3] * deltaSeconds;
            dustPositions[i * 3 + 1] += dustVelocities[i * 3 + 1] * deltaSeconds;
            dustPositions[i * 3 + 2] += dustVelocities[i * 3 + 2] * deltaSeconds;
            dustVelocities[i * 3 + 1] -= 4.0 * deltaSeconds; // Gravity
          } else {
            dustPositions[i * 3 + 1] = -500;
          }
        }
        dustGeom.attributes.position.needsUpdate = true;

        // Telemetry update
        const telemetry = physics.getTelemetry(trailRef.current);
        onUpdateTelemetry(telemetry);

        // Check if finished track
        if (physics.trackDistance >= trailRef.current.totalLength - 10) {
          onFinishRun();
        }
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [trackData, cameraView]);

  // Update bike materials whenever bikeConfig changes in the garage
  useEffect(() => {
    if (bikeMeshRef.current) {
      bikeMeshRef.current.updateMaterials(bikeConfig);
    }
  }, [bikeConfig]);

  // Touch / pointer drag steering directly on the 3D viewport
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDownRef.current = true;
    startXRef.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    if (deltaX < -20) {
      controlsRef.current.steerLeft = true;
      controlsRef.current.steerRight = false;
    } else if (deltaX > 20) {
      controlsRef.current.steerRight = true;
      controlsRef.current.steerLeft = false;
    } else {
      controlsRef.current.steerLeft = false;
      controlsRef.current.steerRight = false;
    }
  };

  const handlePointerUp = () => {
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      controlsRef.current.steerLeft = false;
      controlsRef.current.steerRight = false;
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="w-full h-full relative cursor-crosshair overflow-hidden touch-none select-none"
    />
  );
};
