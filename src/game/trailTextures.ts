import * as THREE from 'three';

/**
 * Procedural texture suite for downhill mountain biking.
 * Generates seamless, high-performance textures for trail dirt, mountain terrain,
 * rock boulders, tree bark, and wooden bridge planks.
 */

// Helper to generate seamless noise
function createPerlinGrid(size: number) {
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.random();
  }
  return grid;
}

/**
 * 1. Singletrack Trail Dirt & Loam Texture
 * Features packed wheel tracks, tire knob ruts, fine gravel flecks, and organic loam grain.
 */
export function createTrailDirtTexture(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  // Base earthy loam tone (neutral grey-brown so vertexColors blend cleanly)
  ctx.fillStyle = '#b8aa98';
  ctx.fillRect(0, 0, size, size);

  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const bumpData = bumpCtx.getImageData(0, 0, size, size);
  const data = imgData.data;
  const bData = bumpData.data;

  // Longitudinal tire ruts and packed soil striations along Y axis (direction of travel)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const u = x / size;
      const v = y / size;

      // Center wear groove (tire tracks where knobbies pack the soil)
      const centerTireTrack = Math.exp(-Math.pow((u - 0.5) * 6.0, 2)) * 0.18;
      const leftRut = Math.exp(-Math.pow((u - 0.28) * 8.0, 2)) * 0.12;
      const rightRut = Math.exp(-Math.pow((u - 0.72) * 8.0, 2)) * 0.12;
      const rutComp = centerTireTrack + leftRut + rightRut;

      // Fine high-frequency organic soil grit
      const grit = (Math.sin(x * 0.6) * Math.cos(y * 0.6) + Math.sin(x * 1.3 + y * 0.9)) * 14;
      const microNoise = (Math.random() - 0.5) * 26;

      // Knobby tire tread imprint ripples along Y
      const knobRipples = Math.sin(v * Math.PI * 36) * Math.sin(u * Math.PI * 18) * 12 * rutComp;

      const delta = (rutComp * -35) + grit + microNoise + knobRipples;

      data[idx] = Math.max(0, Math.min(255, data[idx] + delta * 1.05));
      data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + delta * 0.95));
      data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + delta * 0.85));

      // Bump map (height)
      const bumpVal = Math.max(0, Math.min(255, 128 + delta * 1.4));
      bData[idx] = bumpVal;
      bData[idx + 1] = bumpVal;
      bData[idx + 2] = bumpVal;
    }
  }

  // Scatter individual loose stones / pebbles across trail tread
  for (let p = 0; p < 350; p++) {
    const px = Math.floor(Math.random() * size);
    const py = Math.floor(Math.random() * size);
    const pr = 1.5 + Math.random() * 3.5;
    const isDark = Math.random() > 0.45;
    const col = isDark ? 45 : 210;

    for (let dy = -pr; dy <= pr; dy++) {
      for (let dx = -pr; dx <= pr; dx++) {
        if (dx * dx + dy * dy <= pr * pr) {
          const sx = (px + dx + size) % size;
          const sy = (py + dy + size) % size;
          const sIdx = (sy * size + sx) * 4;
          data[sIdx] = isDark ? 65 : 205;
          data[sIdx + 1] = isDark ? 60 : 195;
          data[sIdx + 2] = isDark ? 55 : 185;
          bData[sIdx] = isDark ? 80 : 215;
          bData[sIdx + 1] = isDark ? 80 : 215;
          bData[sIdx + 2] = isDark ? 80 : 215;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  bumpCtx.putImageData(bumpData, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = 4;

  return { map, bump };
}

/**
 * 2. Alpine Mountain Terrain Texture
 * Multi-scale grass thatch, moss patches, mountain topsoil grain, and micro-scree.
 */
export function createAlpineTerrainTexture(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  // Neutral mountain soil / grass baseline
  ctx.fillStyle = '#c5ccb8';
  ctx.fillRect(0, 0, size, size);

  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const bumpData = bumpCtx.getImageData(0, 0, size, size);
  const data = imgData.data;
  const bData = bumpData.data;

  // Alpine grass blades & lichen clusters
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Low frequency vegetation clump variation
      const clump = Math.sin(x * 0.04) * Math.cos(y * 0.04) * 22;
      // High frequency grass blades / foliage fiber
      const blade = (Math.sin(x * 0.7 + y * 0.2) + Math.cos(x * 0.15 - y * 0.8)) * 15;
      const grain = (Math.random() - 0.5) * 24;

      const totalVal = clump + blade + grain;

      data[idx] = Math.max(0, Math.min(255, data[idx] + totalVal * 0.9));
      data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + totalVal * 1.1));
      data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + totalVal * 0.8));

      const bVal = Math.max(0, Math.min(255, 128 + totalVal * 1.5));
      bData[idx] = bVal;
      bData[idx + 1] = bVal;
      bData[idx + 2] = bVal;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  bumpCtx.putImageData(bumpData, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = 4;

  return { map, bump };
}

/**
 * 3. Granite Rock Slab & Boulder Texture
 * Crystalline granite flecks, metamorphic fissures, and rough mineral grain.
 */
export function createRockTexture(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#949ba3';
  ctx.fillRect(0, 0, size, size);

  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const bumpData = bumpCtx.getImageData(0, 0, size, size);
  const data = imgData.data;
  const bData = bumpData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Fissure cracks & rock strata bands
      const strata = Math.sin((x + y * 0.3) * 0.12) * 18;
      const speckle = (Math.random() - 0.5) * 36;
      // High contrast mineral flecks (quartz & mica)
      const quartz = Math.random() > 0.96 ? 55 : (Math.random() < 0.04 ? -55 : 0);

      const rockMod = strata + speckle + quartz;

      data[idx] = Math.max(0, Math.min(255, data[idx] + rockMod));
      data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + rockMod));
      data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + rockMod * 1.05));

      const bVal = Math.max(0, Math.min(255, 128 + rockMod * 1.6));
      bData[idx] = bVal;
      bData[idx + 1] = bVal;
      bData[idx + 2] = bVal;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  bumpCtx.putImageData(bumpData, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 2;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = 2;

  return { map, bump };
}

/**
 * 4. Tree Trunk Bark Texture
 * Deep longitudinal bark furrows for coniferous alpine pines & giant redwoods.
 */
export function createBarkTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4a3324';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Vertical bark ridge furrows
      const furrow = Math.sin(x * 0.28 + Math.sin(y * 0.08) * 2.5) * 32;
      const grain = (Math.random() - 0.5) * 22;
      const delta = furrow + grain;

      data[idx] = Math.max(0, Math.min(255, data[idx] + delta * 1.1));
      data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + delta * 0.9));
      data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + delta * 0.7));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  return map;
}

/**
 * 5. Weathered Timber Wood Plank Texture
 * For elevated wooden roll-ins, bridges, and start ramp decking.
 */
export function createWoodPlankTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8a6b4a';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    // Horizontal wood plank seam gaps every 32px
    const isSeam = y % 32 < 2;
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      if (isSeam) {
        data[idx] = 35;
        data[idx + 1] = 25;
        data[idx + 2] = 18;
      } else {
        const fiber = Math.sin(x * 0.15 + Math.sin(y * 0.04) * 3) * 16;
        const grain = (Math.random() - 0.5) * 14;
        const delta = fiber + grain;
        data[idx] = Math.max(0, Math.min(255, data[idx] + delta * 1.1));
        data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + delta * 0.95));
        data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + delta * 0.8));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  return map;
}
