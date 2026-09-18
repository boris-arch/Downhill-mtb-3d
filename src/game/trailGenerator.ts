import * as THREE from 'three';
import { TrackData } from '../types/game';

export interface TrailPoint {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  binormal: THREE.Vector3;
  bankAngle: number;
  width: number;
  grade: number; // downhill slope in degrees
  type: 'straight' | 'berm' | 'jump' | 'rock_garden' | 'wood_bridge' | 'drop';
  surface: 'dirt' | 'loose_gravel' | 'wood' | 'rock';
  distance: number;
}

export interface TrailObstacle {
  distance: number;
  lateralOffset: number;
  radius: number;
  height: number;
  type: 'rock' | 'stake' | 'stump';
}

export interface GeneratedTrail {
  curve: THREE.CatmullRomCurve3;
  totalLength: number;
  samples: TrailPoint[];
  getPointAtDistance: (dist: number) => TrailPoint;
  getTrackSurfacePoint: (dist: number, lateralOffset: number) => {
    position: THREE.Vector3;
    normal: THREE.Vector3;
    elevationOffset: number;
  };
  getTerrainHeight: (x: number, z: number) => number;
  obstacles: TrailObstacle[];
  trailMesh: THREE.Mesh;
  terrainMesh: THREE.Mesh;
  sceneryGroup: THREE.Group;
  checkpoints: number[]; // distances along track
}

export function generateTrail(trackData: TrackData): GeneratedTrail {
  const waypoints: THREE.Vector3[] = [];
  const bankAngles: number[] = [];
  const sectionTypes: ('straight' | 'berm' | 'jump' | 'rock_garden' | 'wood_bridge' | 'drop')[] = [];
  const surfaces: ('dirt' | 'loose_gravel' | 'wood' | 'rock')[] = [];

  const totalLength = trackData.lengthMeters;
  const numWaypoints = 70;
  const totalDrop = trackData.elevationDropMeters;

  // Track layout seed variations based on track id
  const isGnar = trackData.id === 'black_diamond';
  const isLoam = trackData.id === 'redwood_loam';

  let currX = 0;
  let currY = totalDrop; // start high at mountain peak
  let currZ = 0;
  let currentAngle = 0;

  for (let i = 0; i <= numWaypoints; i++) {
    const t = i / numWaypoints;

    // Elevation drop curve: steep starts, rolling mid sections, drop chutes, finish plateau
    let dropProgress = t;
    if (isGnar) {
      dropProgress = Math.pow(t, 0.9) + Math.sin(t * Math.PI * 4) * 0.04;
    } else if (isLoam) {
      dropProgress = Math.pow(t, 1.05);
    } else {
      dropProgress = t + Math.sin(t * Math.PI * 6) * 0.03;
    }
    currY = totalDrop * (1.0 - Math.min(1.0, Math.max(0, dropProgress)));

    // Serpentine downhill turns
    let turnRate = 0;
    let bank = 0;
    let type: 'straight' | 'berm' | 'jump' | 'rock_garden' | 'wood_bridge' | 'drop' = 'straight';
    let surface: 'dirt' | 'loose_gravel' | 'wood' | 'rock' = 'dirt';

    const segmentCycle = i % 10;
    if (segmentCycle >= 1 && segmentCycle <= 3) {
      // High speed Left Berm
      turnRate = -0.34;
      bank = -0.42; // ~24 degree bank
      type = 'berm';
      surface = isLoam ? 'dirt' : 'loose_gravel';
    } else if (segmentCycle >= 5 && segmentCycle <= 7) {
      // High speed Right Berm
      turnRate = 0.36;
      bank = 0.44;
      type = 'berm';
      surface = isLoam ? 'dirt' : 'loose_gravel';
    } else if (segmentCycle === 4) {
      // Jump Kicker or Drop
      if (i > 5 && i < numWaypoints - 5) {
        if (isGnar && i % 4 === 0) {
          type = 'drop';
          currY -= 2.6;
          surface = 'rock';
        } else {
          type = 'jump';
          currY += 2.0;
          surface = 'dirt';
        }
      }
    } else if (isGnar && segmentCycle >= 8) {
      type = 'rock_garden';
      surface = 'rock';
    } else if (isLoam && segmentCycle >= 8) {
      type = 'wood_bridge';
      surface = 'wood';
    }

    currentAngle += turnRate * 0.46;
    const stepDist = totalLength / numWaypoints;
    currX += Math.sin(currentAngle) * stepDist * 0.78;
    currZ -= Math.cos(currentAngle) * stepDist;

    // Start flat for first 2 waypoints
    if (i < 2) {
      currX = 0;
      bank = 0;
      type = 'straight';
    }
    // Finish straight for last 3 waypoints
    if (i >= numWaypoints - 3) {
      bank = 0;
      type = 'straight';
    }

    waypoints.push(new THREE.Vector3(currX, currY, currZ));
    bankAngles.push(bank);
    sectionTypes.push(type);
    surfaces.push(surface);
  }

  const curve = new THREE.CatmullRomCurve3(waypoints);
  curve.curveType = 'centripetal';

  // Sample along curve with fine 1.2m steps
  const sampleSteps = Math.floor(totalLength / 1.2);
  const samples: TrailPoint[] = [];

  for (let s = 0; s <= sampleSteps; s++) {
    const t = s / sampleSteps;
    const pos = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const wpIdx = Math.min(waypoints.length - 2, Math.floor(t * (waypoints.length - 1)));
    const localT = (t * (waypoints.length - 1)) - wpIdx;

    const bankA = bankAngles[wpIdx] * (1 - localT) + bankAngles[wpIdx + 1] * localT;
    const type = sectionTypes[wpIdx];
    const surface = surfaces[wpIdx];

    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);

    const normal = new THREE.Vector3().crossVectors(right, tangent).normalize();
    normal.applyAxisAngle(tangent, bankA);
    right.applyAxisAngle(tangent, bankA);

    const grade = Math.atan2(-tangent.y, Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z)) * (180 / Math.PI);

    let width = 4.4;
    if (type === 'berm') width = 5.4;
    if (type === 'wood_bridge') width = 3.8;
    if (type === 'rock_garden') width = 4.2;

    samples.push({
      position: pos,
      tangent,
      normal,
      binormal: right,
      bankAngle: bankA,
      width,
      grade,
      type,
      surface,
      distance: t * totalLength,
    });
  }

  // Continuous smooth fractional distance lookup (prevents 1.2m step stutter)
  const getPointAtDistance = (dist: number): TrailPoint => {
    const clampedDist = Math.max(0, Math.min(totalLength, dist));
    const ratio = clampedDist / totalLength;
    const floatIdx = ratio * (samples.length - 1);
    const idx0 = Math.min(samples.length - 2, Math.floor(floatIdx));
    const idx1 = idx0 + 1;
    const frac = floatIdx - idx0;

    const s0 = samples[idx0];
    const s1 = samples[idx1];

    // Smooth Hermite smoothstep factor for C1 continuity
    const smoothFrac = frac * frac * (3 - 2 * frac);

    const position = new THREE.Vector3().lerpVectors(s0.position, s1.position, frac);
    const tangent = new THREE.Vector3().lerpVectors(s0.tangent, s1.tangent, frac).normalize();
    const normal = new THREE.Vector3().lerpVectors(s0.normal, s1.normal, frac).normalize();
    const binormal = new THREE.Vector3().lerpVectors(s0.binormal, s1.binormal, frac).normalize();
    const bankAngle = THREE.MathUtils.lerp(s0.bankAngle, s1.bankAngle, smoothFrac);
    const width = THREE.MathUtils.lerp(s0.width, s1.width, frac);
    const grade = THREE.MathUtils.lerp(s0.grade, s1.grade, frac);

    return {
      position,
      tangent,
      normal,
      binormal,
      bankAngle,
      width,
      grade,
      type: frac < 0.5 ? s0.type : s1.type,
      surface: frac < 0.5 ? s0.surface : s1.surface,
      distance: clampedDist,
    };
  };

  // Accurate physical surface query matching the 3D trail ribbon cross-section profile
  // Eliminates tire clipping and floating on berms, lips, shoulders and ruts
  const getTrackSurfacePoint = (dist: number, lateralOffset: number) => {
    const tp = getPointAtDistance(dist);
    const halfW = tp.width * 0.5;
    const isBerm = tp.type === 'berm';
    const bankSign = Math.sign(tp.bankAngle);

    const bermLeftLift = isBerm && bankSign < 0 ? 0.65 : 0.12;
    const bermRightLift = isBerm && bankSign > 0 ? 0.65 : 0.12;

    // Evaluate ribbon cross-section elevation delta along tp.normal
    let elevationOffset = 0;
    const absLat = Math.abs(lateralOffset);
    const u = lateralOffset / Math.max(0.1, halfW); // normalized across track (-1 to +1)

    if (u <= -1.0) {
      // Past left track edge out onto berm lip or shoulder
      const t = Math.min(1.0, (-u - 1.0) / 0.35);
      elevationOffset = bermLeftLift * (0.4 + 0.6 * t);
    } else if (u >= 1.0) {
      // Past right track edge out onto berm lip or shoulder
      const t = Math.min(1.0, (u - 1.0) / 0.35);
      elevationOffset = bermRightLift * (0.4 + 0.6 * t);
    } else if (u < 0) {
      // Left side of trail: transition from center (0) to left edge (bermLeftLift * 0.4)
      const absU = -u;
      if (absU < 0.38) {
        // Center packed line -> tire rut (-0.03m)
        const rutT = absU / 0.38;
        elevationOffset = -0.03 * Math.sin(rutT * Math.PI);
      } else {
        // Rut -> track edge
        const edgeT = (absU - 0.38) / 0.62;
        elevationOffset = -0.03 * (1 - edgeT) + (bermLeftLift * 0.4) * edgeT;
      }
    } else {
      // Right side of trail: transition from center (0) to right edge (bermRightLift * 0.4)
      if (u < 0.38) {
        // Center packed line -> tire rut (-0.03m)
        const rutT = u / 0.38;
        elevationOffset = -0.03 * Math.sin(rutT * Math.PI);
      } else {
        // Rut -> track edge
        const edgeT = (u - 0.38) / 0.62;
        elevationOffset = -0.03 * (1 - edgeT) + (bermRightLift * 0.4) * edgeT;
      }
    }

    // World position on the track surface
    const surfacePos = tp.position.clone()
      .addScaledVector(tp.binormal, lateralOffset)
      .addScaledVector(tp.normal, elevationOffset);

    // Dynamic surface normal taking into account the cross-slope of the berm / rut
    const surfaceNormal = tp.normal.clone();
    if (Math.abs(u) > 0.1) {
      const lateralSlope = (u < 0 ? -bermLeftLift : bermRightLift) * 0.45;
      surfaceNormal.addScaledVector(tp.binormal, -lateralSlope * (u < 0 ? -1 : 1)).normalize();
    }

    return {
      position: surfacePos,
      normal: surfaceNormal,
      elevationOffset,
    };
  };

  // =====================================================================
  // 1. SEAMLESS 8-LANE DOWNHILL TRAIL RIBBON WITH DEEP APRON
  // =====================================================================
  const trailGeom = new THREE.BufferGeometry();
  const trailVerts: number[] = [];
  const trailNorms: number[] = [];
  const trailUvs: number[] = [];
  const trailColors: number[] = [];
  const trailIndices: number[] = [];

  const baseDirtColor = new THREE.Color(trackData.groundColor);
  const packedTreadColor = isLoam ? new THREE.Color(0x382212) : new THREE.Color(0x453223);
  const gravelColor = new THREE.Color(0x716253);
  const woodColor = new THREE.Color(0x784a28);
  const rockColor = new THREE.Color(0x52525b);
  const grassEdgeColor = isLoam ? new THREE.Color(0x2d4722) : new THREE.Color(0x3e4d2a);

  // 9 cross-section vertices per slice:
  // 0: Skirt Left (deep anchor beneath terrain)
  // 1: Shoulder / Outer Berm Lip Left
  // 2: Left Track Edge
  // 3: Left Tire Rut (-3cm)
  // 4: Center Packed Line
  // 5: Right Tire Rut (-3cm)
  // 6: Right Track Edge
  // 7: Shoulder / Outer Berm Lip Right
  // 8: Skirt Right (deep anchor beneath terrain)
  const numCrossVerts = 9;

  for (let i = 0; i < samples.length; i++) {
    const sp = samples[i];
    const halfW = sp.width * 0.5;
    const isBerm = sp.type === 'berm';
    const bankSign = Math.sign(sp.bankAngle);

    // Left and right berm lip lift depending on bank direction
    const bermLeftLift = isBerm && bankSign < 0 ? 0.65 : 0.12;
    const bermRightLift = isBerm && bankSign > 0 ? 0.65 : 0.12;

    const v0 = sp.position.clone().addScaledVector(sp.binormal, -halfW * 2.1).addScaledVector(sp.normal, -0.65);
    const v1 = sp.position.clone().addScaledVector(sp.binormal, -halfW * 1.35).addScaledVector(sp.normal, bermLeftLift);
    const v2 = sp.position.clone().addScaledVector(sp.binormal, -halfW).addScaledVector(sp.normal, bermLeftLift * 0.4);
    const v3 = sp.position.clone().addScaledVector(sp.binormal, -halfW * 0.38).addScaledVector(sp.normal, -0.03);
    const v4 = sp.position.clone().addScaledVector(sp.binormal, 0.0);
    const v5 = sp.position.clone().addScaledVector(sp.binormal, halfW * 0.38).addScaledVector(sp.normal, -0.03);
    const v6 = sp.position.clone().addScaledVector(sp.binormal, halfW).addScaledVector(sp.normal, bermRightLift * 0.4);
    const v7 = sp.position.clone().addScaledVector(sp.binormal, halfW * 1.35).addScaledVector(sp.normal, bermRightLift);
    const v8 = sp.position.clone().addScaledVector(sp.binormal, halfW * 2.1).addScaledVector(sp.normal, -0.65);

    const slicePts = [v0, v1, v2, v3, v4, v5, v6, v7, v8];
    const uvV = sp.distance * 0.35;

    // Pick surface base color
    let mainColor = baseDirtColor;
    if (sp.surface === 'wood') mainColor = woodColor;
    else if (sp.surface === 'rock') mainColor = rockColor;
    else if (sp.surface === 'loose_gravel') mainColor = gravelColor;

    slicePts.forEach((p, idx) => {
      trailVerts.push(p.x, p.y, p.z);
      trailNorms.push(sp.normal.x, sp.normal.y, sp.normal.z);
      trailUvs.push(idx / (numCrossVerts - 1), uvV);

      // Vertex color distribution across track
      const c = new THREE.Color(mainColor);
      if (idx === 0 || idx === 8) {
        // Deep skirts blend into forest floor / mountain rock
        c.copy(grassEdgeColor).multiplyScalar(0.7);
      } else if (idx === 1 || idx === 7) {
        // Shoulder berm lip
        c.lerp(grassEdgeColor, 0.45);
      } else if (idx === 3 || idx === 5) {
        // Packed tire ruts
        c.copy(packedTreadColor);
      } else if (idx === 4) {
        // Center singletrack tread
        c.copy(packedTreadColor).multiplyScalar(1.08);
      }
      trailColors.push(c.r, c.g, c.b);
    });

    if (i > 0) {
      const curr = i * numCrossVerts;
      const prev = (i - 1) * numCrossVerts;

      for (let q = 0; q < numCrossVerts - 1; q++) {
        trailIndices.push(prev + q, curr + q, prev + q + 1);
        trailIndices.push(curr + q, curr + q + 1, prev + q + 1);
      }
    }
  }

  trailGeom.setAttribute('position', new THREE.Float32BufferAttribute(trailVerts, 3));
  trailGeom.setAttribute('normal', new THREE.Float32BufferAttribute(trailNorms, 3));
  trailGeom.setAttribute('uv', new THREE.Float32BufferAttribute(trailUvs, 2));
  trailGeom.setAttribute('color', new THREE.Float32BufferAttribute(trailColors, 3));
  trailGeom.setIndex(trailIndices);
  trailGeom.computeVertexNormals();

  const trailMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.08,
    flatShading: false,
  });
  const trailMesh = new THREE.Mesh(trailGeom, trailMat);
  trailMesh.receiveShadow = true;

  // =====================================================================
  // 2. FRACTAL MOUNTAIN TERRAIN WITH DYNAMIC TRACK EMBEDDING
  // =====================================================================
  // Multi-frequency 5-octave Fractal Brownian Motion (FBM) procedural mountain heightmap
  const fbmTerrain = (x: number, z: number) => {
    let val = 0;
    // Broad rolling alpine valley ridges with softer gradients than the previous sharper mountain noise
    val += Math.sin(x * 0.004 + 0.4) * Math.cos(z * 0.0035 + 0.7) * 28;
    val += Math.sin(x * 0.011 + z * 0.009 + 1.2) * 16;
    val += Math.cos(x * 0.026 - z * 0.024 + 1.5) * 8;
    val += Math.sin(x * 0.08 + z * 0.06) * 2.8;
    return val;
  };

  // Strictly calculate the terrain elevation at any arbitrary world coordinate (x, z)
  const getTerrainHeight = (x: number, z: number): number => {
    // Find closest track sample with fine projection to match the ribbon exactly
    const approxT = Math.max(0, Math.min(1.0, -z / totalLength));
    const approxIdx = Math.floor(approxT * (samples.length - 1));
    const searchMin = Math.max(0, approxIdx - 35);
    const searchMax = Math.min(samples.length - 1, approxIdx + 35);

    let bestDistSq = Infinity;
    let closestSample = samples[approxIdx];
    for (let s = searchMin; s <= searchMax; s++) {
      const sp = samples[s];
      const dSq = (x - sp.position.x) ** 2 + (z - sp.position.z) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        closestSample = sp;
      }
    }

    const distToTrack = Math.sqrt(bestDistSq);
    const mountainNoise = fbmTerrain(x, z);

    // Broad valley ramp: smooth and grassy rather than steep, jagged mountain flanks
    let vy = closestSample.position.y - 0.5;
    if (distToTrack > 14) {
      const blendFactor = Math.min(1.0, (distToTrack - 14) / 42);
      const valleyRise = Math.pow((distToTrack - 14) / 38, 1.5) * 18;
      vy = closestSample.position.y - 0.8 + mountainNoise * 0.12 + valleyRise * (0.55 + blendFactor * 0.45);
    } else {
      const apronT = distToTrack / 14;
      const edgeBlend = 1 - Math.min(1, apronT * 1.15);
      vy += -0.12 * apronT + (mountainNoise * 0.1) * edgeBlend;
    }
    return vy;
  };

  // Surface normal helper using central differences of terrain height
  const getTerrainNormal = (x: number, z: number): THREE.Vector3 => {
    const eps = 0.5;
    const hL = getTerrainHeight(x - eps, z);
    const hR = getTerrainHeight(x + eps, z);
    const hD = getTerrainHeight(x, z - eps);
    const hU = getTerrainHeight(x, z + eps);
    const normal = new THREE.Vector3(-(hR - hL) / (2 * eps), 1.0, -(hU - hD) / (2 * eps));
    return normal.normalize();
  };

  // Compute exact track bounding box to center the terrain canvas
  let minTrackX = Infinity;
  let maxTrackX = -Infinity;
  let minTrackZ = Infinity;
  let maxTrackZ = -Infinity;
  for (let s = 0; s < samples.length; s++) {
    const p = samples[s].position;
    if (p.x < minTrackX) minTrackX = p.x;
    if (p.x > maxTrackX) maxTrackX = p.x;
    if (p.z < minTrackZ) minTrackZ = p.z;
    if (p.z > maxTrackZ) maxTrackZ = p.z;
  }

  const trackCenterX = (minTrackX + maxTrackX) * 0.5;
  const trackCenterZ = (minTrackZ + maxTrackZ) * 0.5;
  const trackSpanX = maxTrackX - minTrackX;

  // Ultra-wide high-detail terrain mesh (1,400m width x 1.7x track length, 160 x 240 subdivisions)
  const terrainWidth = Math.max(1400, trackSpanX + 1000);
  const terrainLength = totalLength * 1.72;
  const terrainGeom = new THREE.PlaneGeometry(terrainWidth, terrainLength, 160, 240);
  terrainGeom.rotateX(-Math.PI / 2);
  terrainGeom.translate(trackCenterX, 0, trackCenterZ);

  const posAttr = terrainGeom.attributes.position;
  const terrainColors: number[] = [];

  // Rich multi-biome alpine palette
  const darkSoil = new THREE.Color(0x38281b);
  const mountainLoam = new THREE.Color(0x543d2b);
  const forestMoss = isLoam ? new THREE.Color(0x1c3116) : new THREE.Color(0x28381c);
  const alpineMeadow = isLoam ? new THREE.Color(0x3b5328) : new THREE.Color(0x4c5e34);
  const dryGrass = new THREE.Color(0x656c42);
  const weatheredRock = new THREE.Color(0x5a5c64);
  const slateScree = new THREE.Color(0x3e424c);
  const darkGranite = new THREE.Color(0x24262d);
  const alpineSnow = new THREE.Color(0xe2ebf5);

  for (let v = 0; v < posAttr.count; v++) {
    const vx = posAttr.getX(v);
    const vz = posAttr.getZ(v);

    const vy = getTerrainHeight(vx, vz);
    posAttr.setY(v, vy);

    const trackT = Math.max(0, Math.min(1.0, -vz / totalLength));
    const trackSample = curve.getPointAt(trackT);
    const distToTrack = Math.hypot(vx - trackSample.x, vz - trackSample.z);
    
    // Evaluate surface slope normal for geological realism
    const normal = getTerrainNormal(vx, vz);
    const slopeAngleDeg = Math.acos(Math.max(0, Math.min(1.0, normal.y))) * (180 / Math.PI);
    const noiseVal = fbmTerrain(vx, vz);

    const col = new THREE.Color();
    if (distToTrack < 6.5) {
      // Immediate singletrack shoulder: compact loam and gravel
      col.copy(mountainLoam);
    } else if (distToTrack < 18.0) {
      // Trailside apron: mossy verge blending into alpine meadow
      const t = (distToTrack - 6.5) / 11.5;
      col.copy(mountainLoam).lerp(forestMoss, t);
    } else {
      // Mountain flanks: geological layering based on slope angle and elevation
      if (vy > totalDrop * 0.84 && slopeAngleDeg < 22) {
        // High altitude alpine snow and glacier frost
        col.copy(alpineSnow);
      } else if (slopeAngleDeg > 38 || Math.abs(noiseVal) > 34) {
        // Sheer granite rock faces & vertical cliff bands
        col.copy(darkGranite);
      } else if (slopeAngleDeg > 25 || Math.abs(noiseVal) > 18) {
        // Scree slopes and loose broken talus rock
        col.copy(slateScree).lerp(weatheredRock, 0.4);
      } else if (slopeAngleDeg > 14) {
        // Mixed sub-alpine tundra and weathered scrub grass
        col.copy(dryGrass).lerp(weatheredRock, 0.3);
      } else {
        // Undulating lush alpine valley grass and forest floor
        col.copy(alpineMeadow);
      }
    }

    // Subtle micro-variation based on coordinate noise
    const microVar = ((Math.sin(vx * 0.4) * Math.cos(vz * 0.4)) * 0.05);
    col.r = Math.max(0, Math.min(1, col.r + microVar));
    col.g = Math.max(0, Math.min(1, col.g + microVar));
    col.b = Math.max(0, Math.min(1, col.b + microVar));

    terrainColors.push(col.r, col.g, col.b);
  }

  terrainGeom.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
  terrainGeom.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.04,
    flatShading: false, // Smooth shading with computeVertexNormals for realistic alpine mountain topography
    side: THREE.DoubleSide,
  });
  const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
  terrainMesh.receiveShadow = true;

  // =====================================================================
  // 3. SCENERY: REDWOODS, ALPINES, FERNS, RACE STAKES & BOULDERS
  // =====================================================================
  const sceneryGroup = new THREE.Group();
  const obstacles: TrailObstacle[] = [];

  // Distant Mountain Ranges (Majestic Layered Alpine Skyline with 3 depth tiers)
  const mountainRidgeCount = 20;
  const ridgeGeom = new THREE.ConeGeometry(220, 320, 6);
  const distantTier1Mat = new THREE.MeshStandardMaterial({
    color: isLoam ? 0x223528 : 0x2d3445,
    roughness: 0.94,
    metalness: 0.04,
    flatShading: true,
  });
  const distantTier2Mat = new THREE.MeshStandardMaterial({
    color: isLoam ? 0x18241c : 0x1e2430,
    roughness: 0.96,
    metalness: 0.02,
    flatShading: true,
  });

  const midPoint = curve.getPointAt(0.5);

  for (let r = 0; r < mountainRidgeCount; r++) {
    const angle = (r / mountainRidgeCount) * Math.PI * 2;
    const tier = r % 2 === 0 ? 1 : 2;
    const dist = tier === 1 ? (520 + Math.random() * 180) : (780 + Math.random() * 240);
    const peak = new THREE.Mesh(ridgeGeom, tier === 1 ? distantTier1Mat : distantTier2Mat);
    peak.position.set(
      midPoint.x + Math.sin(angle) * dist,
      midPoint.y + (tier === 1 ? 30 : 70) + Math.random() * 120,
      midPoint.z + Math.cos(angle) * dist
    );
    peak.scale.set(1.4 + Math.random() * 0.9, 1.1 + Math.random() * 0.8, 1.4 + Math.random() * 0.9);
    peak.rotation.y = Math.random() * Math.PI;
    sceneryGroup.add(peak);
  }

  // --- High Quality Multi-Tiered Mountain Trees ---
  const trunkMat = new THREE.MeshStandardMaterial({
    color: isLoam ? 0x422817 : 0x38281f,
    roughness: 0.92,
  });
  const foliageMat1 = new THREE.MeshStandardMaterial({
    color: isLoam ? 0x163824 : 0x22401c,
    roughness: 0.88,
    flatShading: true,
  });
  const foliageMat2 = new THREE.MeshStandardMaterial({
    color: isLoam ? 0x1b432c : 0x2e5424,
    roughness: 0.85,
    flatShading: true,
  });

  const trunkGeom = new THREE.CylinderGeometry(0.35, 0.75, 5.0, 6);
  const foliageCone1 = new THREE.ConeGeometry(3.6, 5.5, 6);
  const foliageCone2 = new THREE.ConeGeometry(2.8, 4.4, 6);
  const foliageCone3 = new THREE.ConeGeometry(2.0, 3.6, 6);
  const foliageCone4 = new THREE.ConeGeometry(1.2, 2.8, 6);

  const createDetailedTree = (x: number, y: number, z: number, scale: number = 1.0) => {
    const tree = new THREE.Group();

    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 2.5 * scale;
    trunk.scale.set(scale, scale, scale);
    trunk.castShadow = true;

    const f1 = new THREE.Mesh(foliageCone1, foliageMat1);
    f1.position.y = 4.8 * scale;
    f1.scale.set(scale, scale, scale);
    f1.castShadow = true;

    const f2 = new THREE.Mesh(foliageCone2, foliageMat2);
    f2.position.y = 7.4 * scale;
    f2.scale.set(scale, scale, scale);
    f2.castShadow = true;

    const f3 = new THREE.Mesh(foliageCone3, foliageMat1);
    f3.position.y = 9.8 * scale;
    f3.scale.set(scale, scale, scale);
    f3.castShadow = true;

    const f4 = new THREE.Mesh(foliageCone4, foliageMat2);
    f4.position.y = 11.8 * scale;
    f4.scale.set(scale, scale, scale);
    f4.castShadow = true;

    tree.add(trunk, f1, f2, f3, f4);
    tree.position.set(x, y, z);
    return tree;
  };

  // --- Granite Boulders & Rock Slab ---
  const boulderGeom = new THREE.DodecahedronGeometry(1.9, 1);
  const rockSlabGeom = new THREE.BoxGeometry(2.4, 0.5, 3.2);
  const boulderMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.88,
    flatShading: true,
  });
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.85,
    flatShading: true,
  });

  // --- Trailside Ferns & Mountain Bushes ---
  const fernGeom = new THREE.ConeGeometry(0.85, 0.55, 6);
  fernGeom.translate(0, 0.275, 0); // Origin at flat base, not vertical center
  const fernMat = new THREE.MeshStandardMaterial({
    color: isLoam ? 0x22c55e : 0x4ade80,
    roughness: 0.8,
    flatShading: true,
  });

  // --- UCI World Cup Course Marking Poles ---
  const stakeGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6);
  const flagGeom = new THREE.BoxGeometry(0.02, 0.35, 0.5);
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
  const yellowFlagMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
  const orangeFlagMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 });

  const createCourseMarker = (pos: THREE.Vector3, isLeft: boolean) => {
    const marker = new THREE.Group();
    const pole = new THREE.Mesh(stakeGeom, stakeMat);
    pole.position.y = 0.8;
    const flag = new THREE.Mesh(flagGeom, isLeft ? yellowFlagMat : orangeFlagMat);
    flag.position.set(0, 1.35, 0.22);
    marker.add(pole, flag);
    marker.position.copy(pos);
    return marker;
  };

  // Populate along the descent
  const treeCount = Math.floor(240 * trackData.treeDensity);
  const rockCount = Math.floor(180 * trackData.rockDensity);

  // 1. Forest groves snapped strictly to ground elevation
  for (let i = 0; i < treeCount; i++) {
    const t = 0.01 + Math.random() * 0.98;
    const pt = curve.getPointAt(t);
    const side = Math.random() > 0.5 ? 1 : -1;
    const offsetDist = 7.5 + Math.random() * 65;

    const normal = curve.getTangentAt(t).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const treePos = pt.clone().addScaledVector(normal, side * offsetDist);
    // Strict terrain snap: evaluate ground surface height at (x, z)
    treePos.y = getTerrainHeight(treePos.x, treePos.z);

    const scale = isLoam ? (1.0 + Math.random() * 1.5) : (0.8 + Math.random() * 0.9);
    const tree = createDetailedTree(treePos.x, treePos.y, treePos.z, scale);
    sceneryGroup.add(tree);
  }

  // 2. Boulders & Stratified Rock Slabs along edges snapped strictly flush to terrain
  for (let i = 0; i < rockCount; i++) {
    const t = 0.02 + Math.random() * 0.96;
    const pt = curve.getPointAt(t);
    const side = Math.random() > 0.5 ? 1 : -1;
    const offsetDist = 3.8 + Math.random() * 32;

    const normal = curve.getTangentAt(t).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const rockPos = pt.clone().addScaledVector(normal, side * offsetDist);
    // Strict terrain snap: embed slightly so no gaps or floating rocks exist
    const groundH = getTerrainHeight(rockPos.x, rockPos.z);
    rockPos.y = groundH + 0.12;

    const isSlab = Math.random() > 0.65;
    const mesh = new THREE.Mesh(isSlab ? rockSlabGeom : boulderGeom, isSlab ? slabMat : boulderMat);
    const s = 0.65 + Math.random() * 1.6;
    mesh.scale.set(s * (0.8 + Math.random() * 0.5), s * (isSlab ? 0.4 : 0.75), s * (0.8 + Math.random() * 0.5));
    mesh.position.copy(rockPos);

    // Ground normal alignment for natural bedding planes
    const gNorm = getTerrainNormal(rockPos.x, rockPos.z);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), gNorm);
    mesh.rotateY(Math.random() * Math.PI * 2);
    mesh.castShadow = true;
    sceneryGroup.add(mesh);
  }

  // 3. Trailside vegetation (ferns & bushes right next to the trail verge)
  const fernCount = 160;
  for (let i = 0; i < fernCount; i++) {
    const t = 0.02 + (i / fernCount) * 0.96;
    const pt = curve.getPointAt(t);
    const side = (i % 2 === 0) ? 1 : -1;
    const offsetDist = 2.8 + Math.random() * 2.2;

    const normal = curve.getTangentAt(t).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const fernPos = pt.clone().addScaledVector(normal, side * offsetDist);
    // Strict ground clamp: flush with terrain surface
    fernPos.y = getTerrainHeight(fernPos.x, fernPos.z) + 0.02;

    const fern = new THREE.Mesh(fernGeom, fernMat);
    const s = 0.5 + Math.random() * 0.6;
    fern.scale.set(s, s * 0.7, s);
    fern.position.copy(fernPos);

    // Align foliage orientation to ground surface normal so it lies flat on slopes
    const groundNormal = getTerrainNormal(fernPos.x, fernPos.z);
    fern.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), groundNormal);
    fern.rotateY(Math.random() * Math.PI * 2);
    sceneryGroup.add(fern);
  }

  // 4. Downhill Course Marking Stakes along berm corners
  for (let i = 0; i < samples.length; i += 8) {
    const sp = samples[i];
    if (sp.type === 'berm') {
      const isRightBerm = sp.bankAngle > 0;
      const side = isRightBerm ? 1 : -1;
      const markerPos = sp.position.clone().addScaledVector(sp.binormal, side * (sp.width * 0.5 + 0.8));
      markerPos.y = getTerrainHeight(markerPos.x, markerPos.z) - 0.1; // stake driven into dirt
      const marker = createCourseMarker(markerPos, !isRightBerm);
      sceneryGroup.add(marker);
    }
  }

  // 4b. Starting Ramp & Drop-In Staging Deck (Seals start gap, provides pro start hill)
  const startPt0 = samples[0];
  const startRampGroup = new THREE.Group();
  startRampGroup.position.copy(startPt0.position);
  startRampGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), startPt0.tangent);

  // Deck planking
  const deckGeom = new THREE.BoxGeometry(startPt0.width * 1.3, 0.28, 14);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.82 });
  const startDeck = new THREE.Mesh(deckGeom, deckMat);
  startDeck.position.set(0, -0.14, 5.0); // extends backward before z=0
  startDeck.castShadow = true;
  startDeck.receiveShadow = true;
  startRampGroup.add(startDeck);

  // Ramp side trusses / guardrails
  const trussGeom = new THREE.BoxGeometry(0.16, 1.1, 14);
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.7, roughness: 0.3 });
  const trussL = new THREE.Mesh(trussGeom, trussMat);
  trussL.position.set(-startPt0.width * 0.65, 0.55, 5.0);
  startRampGroup.add(trussL);

  const trussR = new THREE.Mesh(trussGeom, trussMat);
  trussR.position.set(startPt0.width * 0.65, 0.55, 5.0);
  startRampGroup.add(trussR);

  // Deep foundation skirt under start ramp to bridge seamlessly into mountain mesh
  const foundationGeom = new THREE.BoxGeometry(startPt0.width * 1.5, 4.5, 16);
  const foundationMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 });
  const foundationMesh = new THREE.Mesh(foundationGeom, foundationMat);
  foundationMesh.position.set(0, -2.4, 5.0);
  startRampGroup.add(foundationMesh);

  sceneryGroup.add(startRampGroup);

  // 5. Embedded Rock Slabs on Rock Garden sections
  for (let i = 0; i < samples.length; i += 6) {
    const sp = samples[i];
    if (sp.type === 'rock_garden') {
      const slab = new THREE.Mesh(rockSlabGeom, slabMat);
      const lateralShift = (Math.random() - 0.5) * (sp.width * 0.6);
      slab.position.copy(sp.position).addScaledVector(sp.binormal, lateralShift);
      slab.position.y += 0.08;
      slab.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), sp.tangent);
      slab.rotateX(Math.random() * 0.2 - 0.1);
      slab.rotateY(Math.random() * 0.3 - 0.15);
      slab.castShadow = true;
      slab.receiveShadow = true;
      sceneryGroup.add(slab);

      // Register as physical obstacle for suspension bump and collision impact
      obstacles.push({
        distance: sp.distance,
        lateralOffset: lateralShift,
        radius: 0.85,
        height: 0.28,
        type: 'rock',
      });
    }
  }

  // 5b. Timber Bridge Railings & Under-Bridge Piling Supports on Wooden Elevated Sections
  const woodPostGeom = new THREE.BoxGeometry(0.12, 0.95, 0.12);
  const woodRailGeom = new THREE.BoxGeometry(0.08, 0.10, 2.4);
  const woodBeamMat = new THREE.MeshStandardMaterial({ color: 0x5c3d28, roughness: 0.85 });

  for (let i = 0; i < samples.length; i += 3) {
    const sp = samples[i];
    if (sp.surface === 'wood') {
      const halfW = sp.width * 0.5;

      // Left railing post
      const postL = new THREE.Mesh(woodPostGeom, woodBeamMat);
      postL.position.copy(sp.position).addScaledVector(sp.binormal, -halfW - 0.1).addScaledVector(sp.normal, 0.45);
      postL.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), sp.tangent);
      sceneryGroup.add(postL);

      // Right railing post
      const postR = new THREE.Mesh(woodPostGeom, woodBeamMat);
      postR.position.copy(sp.position).addScaledVector(sp.binormal, halfW + 0.1).addScaledVector(sp.normal, 0.45);
      postR.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), sp.tangent);
      sceneryGroup.add(postR);

      // Horizontal top guardrails (every 2 samples)
      if (i % 6 === 0) {
        const railL = new THREE.Mesh(woodRailGeom, woodBeamMat);
        railL.position.copy(sp.position).addScaledVector(sp.binormal, -halfW - 0.1).addScaledVector(sp.normal, 0.85);
        railL.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), sp.tangent);
        sceneryGroup.add(railL);

        const railR = new THREE.Mesh(woodRailGeom, woodBeamMat);
        railR.position.copy(sp.position).addScaledVector(sp.binormal, halfW + 0.1).addScaledVector(sp.normal, 0.85);
        railR.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), sp.tangent);
        sceneryGroup.add(railR);
      }
    }
  }

  // 6. Checkpoint & Finish Line Gate Arches
  const checkpoints = [
    totalLength * 0.25,
    totalLength * 0.50,
    totalLength * 0.75,
    totalLength * 0.99,
  ];

  checkpoints.forEach((dist, idx) => {
    const sp = getPointAtDistance(dist);
    const isFinish = idx === checkpoints.length - 1;

    const archGroup = new THREE.Group();
    archGroup.position.copy(sp.position);
    archGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), sp.tangent);

    // Modern mountain downhill truss gate
    const pillarGeom = new THREE.BoxGeometry(0.5, 4.8, 0.5);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: isFinish ? 0xd97706 : 0x0f172a,
      metalness: 0.4,
      roughness: 0.6,
    });
    const pL = new THREE.Mesh(pillarGeom, pillarMat);
    pL.position.set(-sp.width * 0.65, 2.4, 0);
    const pR = new THREE.Mesh(pillarGeom, pillarMat);
    pR.position.set(sp.width * 0.65, 2.4, 0);

    const bannerGeom = new THREE.BoxGeometry(sp.width * 1.45, 1.1, 0.35);
    const bannerMat = new THREE.MeshStandardMaterial({
      color: isFinish ? 0xf59e0b : 0x0284c7,
      metalness: 0.2,
      roughness: 0.4,
    });
    const banner = new THREE.Mesh(bannerGeom, bannerMat);
    banner.position.set(0, 4.6, 0);

    archGroup.add(pL, pR, banner);
    sceneryGroup.add(archGroup);
  });

  return {
    curve,
    totalLength,
    samples,
    getPointAtDistance,
    getTrackSurfacePoint,
    getTerrainHeight,
    obstacles,
    trailMesh,
    terrainMesh,
    sceneryGroup,
    checkpoints,
  };
}
