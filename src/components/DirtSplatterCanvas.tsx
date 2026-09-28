import React, { useEffect, useRef } from 'react';
import { TelemetryData, CameraView } from '../types/game';

interface DirtSplatterCanvasProps {
  telemetry: TelemetryData;
  cameraView: CameraView;
  isPaused: boolean;
}

interface SplatterDrop {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  maxOpacity: number;
  decayRate: number; // rate per second
  splatterNodes: { dx: number; dy: number; r: number }[];
  dripLength: number;
  dripSpeed: number;
  isDripping: boolean;
  age: number;
}

export const DirtSplatterCanvas: React.FC<DirtSplatterCanvasProps> = ({
  telemetry,
  cameraView,
  isPaused,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const splattersRef = useRef<SplatterDrop[]>([]);
  const lastSpawnTimeRef = useRef<number>(0);
  const telemetryRef = useRef<TelemetryData>(telemetry);
  telemetryRef.current = telemetry;

  // Organic muddy color palette (wet deep mud, clay loam, earthy silt, water splatter)
  const mudColors = [
    'rgba(38, 24, 13, ',   // Deep wet organic peat mud
    'rgba(56, 36, 20, ',   // Heavy clay loam
    'rgba(74, 48, 28, ',   // Dark wet forest soil
    'rgba(94, 64, 38, ',   // Sandy mud silt
    'rgba(30, 20, 12, ',   // Rich volcanic trail mud
  ];

  // Canvas size and animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    // Handle high DPI crisp rendering
    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const spawnSplatter = (speedRatio: number, isDirectMud: boolean) => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // When riding in 1st person (helmet/stem), camera sits right behind the front tire roost
      // More splatters strike the lower-center and edges of the goggle / lens
      const centerX = width * 0.5;
      const centerY = height * 0.55;

      // Random position with bias towards center-bottom and flying outward
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.pow(Math.random(), 0.75) * (Math.min(width, height) * 0.48);
      const x = centerX + Math.cos(angle) * spread + (Math.random() - 0.5) * 80;
      const y = centerY + Math.sin(angle) * spread * 0.85 + (Math.random() - 0.5) * 60;

      // Base radius scales with speed (faster = bigger, harder impact splatter)
      const baseRadius = isDirectMud
        ? 7 + speedRatio * 18 + Math.random() * 12
        : 3 + speedRatio * 8 + Math.random() * 5;

      const colorBase = mudColors[Math.floor(Math.random() * mudColors.length)];
      const maxOpacity = 0.55 + Math.random() * 0.35; // Semi-transparent wet mud

      // Procedural organic satellites / splash micro-droplets around the main glob
      const numNodes = Math.floor(4 + Math.random() * 7);
      const splatterNodes: { dx: number; dy: number; r: number }[] = [];
      for (let n = 0; n < numNodes; n++) {
        const nodeAngle = Math.random() * Math.PI * 2;
        const dist = baseRadius * (0.8 + Math.random() * 1.5);
        splatterNodes.push({
          dx: Math.cos(nodeAngle) * dist,
          dy: Math.sin(nodeAngle) * dist,
          r: baseRadius * (0.15 + Math.random() * 0.35),
        });
      }

      // Faster speed = higher wind resistance drying/clearing off the lens
      // Base decay rate ranges between 0.12 and 0.28 per second
      const baseDecay = 0.14 + Math.random() * 0.12;

      splattersRef.current.push({
        x,
        y,
        radius: baseRadius,
        color: colorBase,
        opacity: 0.1, // starts soft and reaches maxOpacity quickly
        maxOpacity,
        decayRate: baseDecay,
        splatterNodes,
        dripLength: 0,
        dripSpeed: 8 + Math.random() * 22,
        isDripping: Math.random() < 0.45 && baseRadius > 10,
        age: 0,
      });

      // Cap max simultaneous splatters to prevent lag
      if (splattersRef.current.length > 55) {
        splattersRef.current.shift();
      }
    };

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      if (isPaused) {
        lastTime = now;
        return;
      }

      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const telem = telemetryRef.current;
      const speedKmh = telem.speedKmh || 0;
      const speedRatio = Math.min(1.0, speedKmh / 65);
      const isMud = telem.surfaceName === 'mud';

      // --- 1. DYNAMIC MUD & GRAVEL SPLATTER SPAWNING ---
      if (isMud && speedKmh > 5) {
        // High frequency splatter hits when plowing through mud patches
        // Spawn interval decreases with speed (down to 65ms at full throttle)
        const spawnInterval = Math.max(65, 320 - speedRatio * 240);
        if (now - lastSpawnTimeRef.current > spawnInterval) {
          lastSpawnTimeRef.current = now;
          const count = Math.random() < speedRatio ? 2 : 1;
          for (let c = 0; c < count; c++) {
            spawnSplatter(speedRatio, true);
          }
        }
      } else if (telem.surfaceName === 'loose_gravel' && speedKmh > 38) {
        // Occasional light silt flecks on fast gravel scree
        if (now - lastSpawnTimeRef.current > 600) {
          lastSpawnTimeRef.current = now;
          if (Math.random() < 0.5) spawnSplatter(speedRatio, false);
        }
      }

      // --- 2. UPDATE & DRAW ACTIVE SPLATTERS ---
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const splatters = splattersRef.current;
      for (let i = splatters.length - 1; i >= 0; i--) {
        const s = splatters[i];
        s.age += dt;

        // Splat impact animation: quickly swells to maxOpacity in first 0.08s
        if (s.age < 0.08) {
          s.opacity = (s.age / 0.08) * s.maxOpacity;
        } else {
          // Decay rate is dynamically accelerated by current forward airspeed / wind
          // When bike is travelling fast out of mud, wind blows dirt dry faster
          const windDecayMultiplier = isMud ? 0.65 : (1.0 + speedRatio * 1.8);
          s.opacity -= s.decayRate * windDecayMultiplier * dt;
        }

        // Wet mud gravity drip on larger globules
        if (s.isDripping && s.opacity > 0.35) {
          s.dripLength += s.dripSpeed * dt * Math.min(1.0, s.opacity);
        }

        if (s.opacity <= 0) {
          splatters.splice(i, 1);
          continue;
        }

        // Render organic mud splatter
        ctx.save();
        ctx.fillStyle = `${s.color}${s.opacity.toFixed(3)})`;

        // 1. Central splatter body with soft irregular contour
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Satellite splash droplets radiating outward
        for (let j = 0; j < s.splatterNodes.length; j++) {
          const node = s.splatterNodes[j];
          ctx.beginPath();
          ctx.arc(s.x + node.dx, s.y + node.dy, node.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. Gravity drip trail
        if (s.dripLength > 1) {
          ctx.beginPath();
          ctx.moveTo(s.x - s.radius * 0.35, s.y);
          ctx.lineTo(s.x + s.radius * 0.35, s.y);
          ctx.lineTo(s.x + s.radius * 0.15, s.y + s.dripLength);
          ctx.arc(s.x, s.y + s.dripLength, s.radius * 0.22, 0, Math.PI);
          ctx.lineTo(s.x - s.radius * 0.35, s.y);
          ctx.fill();
        }

        // 4. Subtle inner glossy highlight for wet mud shine
        if (s.opacity > 0.45 && s.radius > 8) {
          ctx.fillStyle = `rgba(255, 255, 255, ${(s.opacity * 0.22).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(s.x - s.radius * 0.28, s.y - s.radius * 0.28, s.radius * 0.24, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPaused, cameraView]);

  return (
    <canvas
      ref={canvasRef}
      id="dirt-splatter-canvas"
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
    />
  );
};
