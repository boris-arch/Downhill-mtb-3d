import * as THREE from 'three';
import { BikeCustomization } from '../types/game';

export interface BikeMeshSystem {
  rootGroup: THREE.Group;
  frameGroup: THREE.Group;
  swingarmGroup: THREE.Group;
  forkBaseGroup: THREE.Group;
  forkSteerGroup: THREE.Group;
  forkLowersGroup: THREE.Group;
  frontWheelGroup: THREE.Group;
  rearWheelGroup: THREE.Group;
  crankGroup: THREE.Group;
  pedalL: THREE.Mesh;
  pedalR: THREE.Mesh;
  rearShockGroup: THREE.Group;
  leftBrakeLever: THREE.Mesh;
  rightBrakeLever: THREE.Mesh;
  computerCanvas: HTMLCanvasElement;
  computerTexture: THREE.CanvasTexture;
  updateTransforms: (
    steerAngle: number,
    frontCompression: number,
    rearCompression: number,
    wheelRot: number,
    brakePull: number,
    pedalRot: number,
    speedKmh: number,
    altitude: number,
    currentGear: number,
    frontBrakePull?: number
  ) => void;
  updateMaterials: (customization: BikeCustomization) => void;
}

/**
 * Creates a clean cylinder tube connecting point A to point B in 3D space
 */
function createTubeBetween(
  pA: THREE.Vector3,
  pB: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  radialSegments = 12
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(pB, pA);
  const length = dir.length();

  const geom = new THREE.CylinderGeometry(radius, radius, length, radialSegments);
  const mesh = new THREE.Mesh(geom, material);

  // Place center halfway between pA and pB
  mesh.position.copy(pA).addScaledVector(dir, 0.5);

  // Standard cylinder in Three.js is aligned with the Y-axis (0, 1, 0)
  const up = new THREE.Vector3(0, 1, 0);
  const normDir = dir.clone().normalize();
  mesh.quaternion.setFromUnitVectors(up, normDir);

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds a realistic 29" knobby downhill mountain bike wheel
 * Forward travel is -Z, lateral is X, vertical is Y.
 * Rolling wheel rotates around X axis.
 */
function createWheel(
  rimRadius: number,
  tireRadius: number,
  rimMat: THREE.Material,
  tireMat: THREE.Material,
  spokeMat: THREE.Material,
  rotorMat: THREE.Material,
  includeCassette: boolean = false
): THREE.Group {
  const wheelGroup = new THREE.Group();

  // Knobby Outer Tire (Torus oriented in Y-Z plane so it rolls around X-axis)
  const tireGeom = new THREE.TorusGeometry(rimRadius, tireRadius, 14, 32);
  tireGeom.rotateY(Math.PI / 2); // Orient torus normal to X axis
  const tireMesh = new THREE.Mesh(tireGeom, tireMat);
  tireMesh.castShadow = true;
  wheelGroup.add(tireMesh);

  // Aggressive Downhill Knobby Tire Lugs (Center braking paddles + side cornering knobs)
  const lugCount = 28;
  const centerLugGeom = new THREE.BoxGeometry(0.024, 0.012, 0.018);
  const sideLugGeom = new THREE.BoxGeometry(0.016, 0.010, 0.022);

  for (let k = 0; k < lugCount; k++) {
    const angle = (k / lugCount) * Math.PI * 2;
    const outerR = rimRadius + tireRadius * 0.96;

    // Center knob
    const centerLug = new THREE.Mesh(centerLugGeom, tireMat);
    centerLug.position.set(0, Math.cos(angle) * outerR, Math.sin(angle) * outerR);
    centerLug.rotation.x = -angle;
    wheelGroup.add(centerLug);

    // Side cornering knobs (Left & Right)
    const sideLugL = new THREE.Mesh(sideLugGeom, tireMat);
    sideLugL.position.set(-tireRadius * 0.72, Math.cos(angle + 0.1) * (outerR - 0.005), Math.sin(angle + 0.1) * (outerR - 0.005));
    sideLugL.rotation.x = -(angle + 0.1);
    sideLugL.rotation.z = 0.35;
    wheelGroup.add(sideLugL);

    const sideLugR = new THREE.Mesh(sideLugGeom, tireMat);
    sideLugR.position.set(tireRadius * 0.72, Math.cos(angle + 0.1) * (outerR - 0.005), Math.sin(angle + 0.1) * (outerR - 0.005));
    sideLugR.rotation.x = -(angle + 0.1);
    sideLugR.rotation.z = -0.35;
    wheelGroup.add(sideLugR);
  }

  // Carbon / Alloy Rim with aerodynamic deep profile
  const rimGeom = new THREE.TorusGeometry(rimRadius - 0.02, 0.024, 10, 32);
  rimGeom.rotateY(Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeom, rimMat);
  wheelGroup.add(rimMesh);

  // Billet Center Hub
  const hubGeom = new THREE.CylinderGeometry(0.028, 0.028, 0.11, 14);
  hubGeom.rotateZ(Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeom, rimMat);
  wheelGroup.add(hubMesh);

  // 12-Speed Steel Downhill Cassette Cogs (10-52T) on drive side (Right side)
  if (includeCassette) {
    const cogCount = 5;
    const cassetteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.25 });
    for (let c = 0; c < cogCount; c++) {
      const cogR = 0.045 + c * 0.016;
      const cogGeom = new THREE.CylinderGeometry(cogR, cogR, 0.005, 20);
      cogGeom.rotateZ(Math.PI / 2);
      const cog = new THREE.Mesh(cogGeom, cassetteMat);
      cog.position.set(0.035 + c * 0.006, 0, 0);
      wheelGroup.add(cog);
    }
  }

  // Stainless Steel Spokes (16 pairs)
  const spokeCount = 16;
  const spokeGeom = new THREE.CylinderGeometry(0.002, 0.002, rimRadius * 0.95, 4);
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    const spokeL = new THREE.Mesh(spokeGeom, spokeMat);
    spokeL.position.set(-0.025, Math.cos(angle) * (rimRadius * 0.45), Math.sin(angle) * (rimRadius * 0.45));
    spokeL.rotation.x = -angle;
    spokeL.rotation.z = 0.08;
    wheelGroup.add(spokeL);

    const spokeR = new THREE.Mesh(spokeGeom, spokeMat);
    spokeR.position.set(0.025, Math.cos(angle + 0.15) * (rimRadius * 0.45), Math.sin(angle + 0.15) * (rimRadius * 0.45));
    spokeR.rotation.x = -(angle + 0.15);
    spokeR.rotation.z = -0.08;
    wheelGroup.add(spokeR);
  }

  // 220mm Floating Disc Brake Rotor (Left side) with vented cutouts
  const rotorGeom = new THREE.RingGeometry(0.045, 0.11, 24);
  rotorGeom.rotateY(Math.PI / 2);
  const rotorMesh = new THREE.Mesh(rotorGeom, rotorMat);
  rotorMesh.position.set(-0.042, 0, 0);
  wheelGroup.add(rotorMesh);

  return wheelGroup;
}

export function createBikeModel(customization: BikeCustomization): BikeMeshSystem {
  const rootGroup = new THREE.Group();

  // === MATERIALS ===
  const isTitanium = customization.frame.id === 'titanium_freeride';
  const isAlloy = customization.frame.id === 'alloy_dh';

  const frameMat = new THREE.MeshStandardMaterial({
    color: customization.frame.color,
    roughness: isTitanium ? 0.35 : 0.45,
    metalness: isAlloy ? 0.75 : isTitanium ? 0.85 : 0.25,
  });

  const darkAlloyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.8,
  });

  const kashimaMat = new THREE.MeshStandardMaterial({
    color: 0xd97706, // High-polish Kashima gold stanchion coat
    roughness: 0.12,
    metalness: 0.92,
  });

  const forkLowersMat = new THREE.MeshStandardMaterial({
    color: customization.fork.color,
    roughness: 0.4,
    metalness: 0.3,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: customization.wheels.rimColor,
    roughness: 0.35,
    metalness: 0.6,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.9,
    metalness: 0.05,
  });

  const spokeMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.2,
    metalness: 0.9,
  });

  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.95,
    side: THREE.DoubleSide,
  });

  const barMat = new THREE.MeshStandardMaterial({
    color: customization.cockpit.barColor,
    roughness: 0.3,
    metalness: 0.7,
  });

  const gripMat = new THREE.MeshStandardMaterial({
    color: customization.cockpit.gripColor,
    roughness: 0.9,
    metalness: 0.0,
  });

  const brakeLeverMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.85,
  });

  const saddleMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.85,
    metalness: 0.05,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0xea580c, // Racing orange gloves
    roughness: 0.75,
    metalness: 0.1,
  });

  // === COORDINATE REFERENCE SYSTEM ===
  // In bike space:
  // Forward is -Z (downhill)
  // Up is +Y
  // Right is +X, Left is -X
  // Wheel radius: 0.37m (29er)
  // Rear Axle: (0, 0.37, +0.62)
  // Bottom Bracket: (0, 0.36, 0.00)
  // Head Tube: (0, 0.88, -0.48)
  // Front Axle: (0, 0.37, -0.72)

  const posRearAxle = new THREE.Vector3(0, 0.37, 0.62);
  const posBB = new THREE.Vector3(0, 0.36, 0.00);
  const posHeadTubeTop = new THREE.Vector3(0, 0.91, -0.46);
  const posHeadTubeBottom = new THREE.Vector3(0, 0.78, -0.52);
  const posSeatJunction = new THREE.Vector3(0, 0.72, 0.22);
  const posSaddle = new THREE.Vector3(0, 0.76, 0.26);

  // === 1. MAIN FRAME ===
  const frameGroup = new THREE.Group();
  rootGroup.add(frameGroup);

  // Head Tube
  frameGroup.add(createTubeBetween(posHeadTubeBottom, posHeadTubeTop, 0.034, frameMat));

  // Top Tube: HeadTubeTop -> SeatJunction
  frameGroup.add(createTubeBetween(posHeadTubeTop, posSeatJunction, 0.030, frameMat));

  // Down Tube: HeadTubeBottom -> BottomBracket
  frameGroup.add(createTubeBetween(posHeadTubeBottom, posBB, 0.038, frameMat));

  // Seat Tube: BottomBracket -> SeatJunction
  frameGroup.add(createTubeBetween(posBB, posSeatJunction, 0.028, frameMat));

  // Seat Post: SeatJunction -> Saddle
  frameGroup.add(createTubeBetween(posSeatJunction, posSaddle, 0.020, darkAlloyMat));

  // Downhill Racing Saddle (Compact, low profile, angled nose)
  const saddleGeom = new THREE.BoxGeometry(0.12, 0.035, 0.22);
  const saddle = new THREE.Mesh(saddleGeom, saddleMat);
  saddle.position.set(0, posSaddle.y + 0.02, posSaddle.z + 0.02);
  saddle.rotation.x = 0.12; // tilted slightly up for downhill control
  saddle.castShadow = true;
  frameGroup.add(saddle);

  // === 2. ARTICULATED REAR SUSPENSION SWINGARM & LINKAGE ===
  // In true downhill mountain bikes (Horst-link / single-pivot / VPP),
  // the entire rear triangle pivots around the main pivot near the bottom bracket.
  // When the rear wheel hits bumps or the rider pumps into berms, the swingarm arches
  // upward, pivoting around posBB and compressing the rear shock.
  const swingarmGroup = new THREE.Group();
  swingarmGroup.position.copy(posBB);
  frameGroup.add(swingarmGroup);

  // In swingarm local coordinates, posBB is (0, 0, 0)
  // Local Rear Axle offset: posRearAxle - posBB
  const localRearAxle = new THREE.Vector3().subVectors(posRearAxle, posBB);
  const localRA_L = new THREE.Vector3(-0.075, localRearAxle.y, localRearAxle.z);
  const localRA_R = new THREE.Vector3(0.075, localRearAxle.y, localRearAxle.z);
  const localBB_L = new THREE.Vector3(-0.065, 0, 0);
  const localBB_R = new THREE.Vector3(0.065, 0, 0);

  // Main Pivot Bearings & Axle
  const pivotBearingGeom = new THREE.CylinderGeometry(0.024, 0.024, 0.14, 14);
  pivotBearingGeom.rotateZ(Math.PI / 2);
  const pivotBearing = new THREE.Mesh(pivotBearingGeom, darkAlloyMat);
  swingarmGroup.add(pivotBearing);

  // Rear Chainstays (Left & Right): Pivot -> Rear Axle Dropouts
  swingarmGroup.add(createTubeBetween(localBB_L, localRA_L, 0.018, frameMat));
  swingarmGroup.add(createTubeBetween(localBB_R, localRA_R, 0.018, frameMat));

  // Upright Linkage Bridge & Seatstays
  // Linkage pivot point that drives the rear shock
  const localLinkPivot = new THREE.Vector3(0, 0.16, 0.15);
  swingarmGroup.add(createTubeBetween(localRA_L, new THREE.Vector3(-0.05, localLinkPivot.y, localLinkPivot.z), 0.015, frameMat));
  swingarmGroup.add(createTubeBetween(localRA_R, new THREE.Vector3(0.05, localLinkPivot.y, localLinkPivot.z), 0.015, frameMat));
  swingarmGroup.add(createTubeBetween(new THREE.Vector3(-0.05, localLinkPivot.y, localLinkPivot.z), localBB_L, 0.015, frameMat));
  swingarmGroup.add(createTubeBetween(new THREE.Vector3(0.05, localLinkPivot.y, localLinkPivot.z), localBB_R, 0.015, frameMat));

  // Rear Suspension Shock Mount & Coil (Anchored to frame, driven by linkage)
  const rearShockGroup = new THREE.Group();
  rearShockGroup.position.set(0, 0.52, 0.10);
  frameGroup.add(rearShockGroup);

  const shockBody = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 12), darkAlloyMat);
  shockBody.rotation.x = -0.65;
  rearShockGroup.add(shockBody);

  const shockCoilMat = new THREE.MeshStandardMaterial({
    color: customization.shock.coilColor,
    roughness: 0.3,
    metalness: 0.8,
  });
  const shockCoil = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.007, 8, 20), shockCoilMat);
  shockCoil.rotation.x = -0.65;
  rearShockGroup.add(shockCoil);

  // === 3. CRANKSET & PEDALS ===
  const crankGroup = new THREE.Group();
  crankGroup.position.copy(posBB);
  frameGroup.add(crankGroup);

  // Chainring (34T DH sprocket)
  const chainring = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.005, 24), darkAlloyMat);
  chainring.rotateZ(Math.PI / 2);
  chainring.position.set(0.06, 0, 0);
  crankGroup.add(chainring);

  // Crank Arms & Flat MTB Pedals (Left & Right)
  const crankArmL = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.165, 0.014), darkAlloyMat);
  crankArmL.position.set(-0.075, 0.05, 0);
  crankGroup.add(crankArmL);

  const pedalL = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.018, 0.095), darkAlloyMat);
  pedalL.position.set(-0.115, 0.12, 0);
  crankGroup.add(pedalL);

  const crankArmR = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.165, 0.014), darkAlloyMat);
  crankArmR.position.set(0.075, -0.05, 0);
  crankGroup.add(crankArmR);

  const pedalR = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.018, 0.095), darkAlloyMat);
  pedalR.position.set(0.115, -0.12, 0);
  crankGroup.add(pedalR);

  // === 4. REAR WHEEL & DRIVETRAIN (Mounted directly on articulated swingarm) ===
  const rearWheelGroup = createWheel(0.31, 0.06, rimMat, tireMat, spokeMat, rotorMat, true);
  rearWheelGroup.position.copy(localRearAxle);
  swingarmGroup.add(rearWheelGroup);

  // Rear Derailleur & Clutch Cage (Right side, below rear axle on swingarm)
  const derailleurGroup = new THREE.Group();
  derailleurGroup.position.set(localRearAxle.x + 0.082, localRearAxle.y - 0.04, localRearAxle.z - 0.02);
  const derailleurBody = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.05), darkAlloyMat);
  derailleurGroup.add(derailleurBody);

  // Twin Jockey Wheels
  const jockeyMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
  const jockey1 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 12), jockeyMat);
  jockey1.rotateZ(Math.PI / 2);
  jockey1.position.set(0.01, -0.02, 0.01);
  derailleurGroup.add(jockey1);

  const jockey2 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 12), jockeyMat);
  jockey2.rotateZ(Math.PI / 2);
  jockey2.position.set(0.01, -0.06, -0.02);
  derailleurGroup.add(jockey2);
  swingarmGroup.add(derailleurGroup);

  // Drive Chain Loop (Connecting Chainring to Cassette on Swingarm)
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
  const topChain = createTubeBetween(
    new THREE.Vector3(0.06, 0.08, 0),
    new THREE.Vector3(0.065, localRearAxle.y + 0.07, localRearAxle.z),
    0.005,
    chainMat
  );
  swingarmGroup.add(topChain);
  const btmChain = createTubeBetween(
    new THREE.Vector3(0.06, -0.08, 0),
    new THREE.Vector3(0.065, localRearAxle.y - 0.07, localRearAxle.z),
    0.005,
    chainMat
  );
  swingarmGroup.add(btmChain);

  // 4-Piston Hydraulic Rear Brake Caliper (Mounted to swingarm disc tab)
  const rearCaliper = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.06, 0.04), darkAlloyMat);
  rearCaliper.position.set(-0.055, localRearAxle.y + 0.05, localRearAxle.z - 0.04);
  rearCaliper.rotation.x = -0.45;
  swingarmGroup.add(rearCaliper);

  // === 4. FRONT FORK & STEERING SYSTEM ===
  // Slack Downhill Head Angle: ~64 degrees from horizontal, ~26 degrees from vertical
  // In our system, the headtube tilts forward into -Z
  const headAngle = Math.atan2(posHeadTubeBottom.z - posHeadTubeTop.z, posHeadTubeTop.y - posHeadTubeBottom.y);

  // Fork Base Group: Anchored at Head Tube Top, angled along head angle
  const forkBaseGroup = new THREE.Group();
  forkBaseGroup.position.copy(posHeadTubeTop);
  forkBaseGroup.rotation.x = -headAngle; // tilts forward into -Z
  frameGroup.add(forkBaseGroup);

  // Fork Steer Group: Rotates around steering axis (local Y)
  const forkSteerGroup = new THREE.Group();
  forkBaseGroup.add(forkSteerGroup);

  // Upper Triple Clamp (Direct Stem Mount)
  const topCrown = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.024, 0.06), darkAlloyMat);
  topCrown.position.set(0, 0, 0);
  forkSteerGroup.add(topCrown);

  // Lower Crown
  const lowerCrown = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.024, 0.06), darkAlloyMat);
  lowerCrown.position.set(0, -0.16, 0);
  forkSteerGroup.add(lowerCrown);

  // 40mm Kashima Upper Stanchions (Fixed to steer group)
  const stanchionL = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.50, 14), kashimaMat);
  stanchionL.position.set(-0.075, -0.22, 0);
  forkSteerGroup.add(stanchionL);

  const stanchionR = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.50, 14), kashimaMat);
  stanchionR.position.set(0.075, -0.22, 0);
  forkSteerGroup.add(stanchionR);

  // Fork Lowers (Compresses along stanchions: slides up along local Y)
  const forkLowersGroup = new THREE.Group();
  forkLowersGroup.position.set(0, -0.26, 0);
  forkSteerGroup.add(forkLowersGroup);

  // Lower Magnesium Legs
  const lowerLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.022, 0.38, 14), forkLowersMat);
  lowerLegL.position.set(-0.075, -0.16, 0);
  forkLowersGroup.add(lowerLegL);

  const lowerLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.022, 0.38, 14), forkLowersMat);
  lowerLegR.position.set(0.075, -0.16, 0);
  forkLowersGroup.add(lowerLegR);

  // Fork Arch (Brace joining lowers)
  const archGeom = new THREE.TorusGeometry(0.08, 0.016, 8, 16, Math.PI);
  archGeom.rotateZ(Math.PI);
  const forkArch = new THREE.Mesh(archGeom, forkLowersMat);
  forkArch.position.set(0, -0.02, 0.015);
  forkLowersGroup.add(forkArch);

  // 20mm Thru-Axle Dropouts & Front Wheel
  const frontWheelGroup = createWheel(0.31, 0.06, rimMat, tireMat, spokeMat, rotorMat);
  frontWheelGroup.position.set(0, -0.32, 0.035); // 35mm fork offset
  forkLowersGroup.add(frontWheelGroup);

  // 4-Piston Hydraulic Front Brake Caliper
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.06, 0.04), darkAlloyMat);
  caliper.position.set(-0.055, -0.22, 0.03);
  forkLowersGroup.add(caliper);

  // === 5. COCKPIT & HANDLEBARS (Direct mounted to top crown) ===
  const cockpitGroup = new THREE.Group();
  // Flush mount with top crown: zero vertical gap
  cockpitGroup.position.set(0, 0.012, 0.0);
  forkSteerGroup.add(cockpitGroup);

  // Steer tube spacer collar / headset stack sealing beneath stem
  const spacerCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.035, 16),
    darkAlloyMat
  );
  spacerCollar.position.set(0, 0.005, 0);
  cockpitGroup.add(spacerCollar);

  // Direct Mount CNC Stem Block (bridges seamlessly across upper fork crown)
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.036, 0.065), darkAlloyMat);
  stem.position.set(0, 0.022, -0.015);
  cockpitGroup.add(stem);

  // Stem faceplate clamp with 4 titanium bolt heads
  const faceplate = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.032, 0.014), darkAlloyMat);
  faceplate.position.set(0, 0.025, -0.048);
  cockpitGroup.add(faceplate);

  // 820mm Downhill Riser Handlebars (wide, aggressive posture)
  const barWidth = Math.max(0.82, (customization.cockpit.barWidth || 800) / 1000);
  const barGeom = new THREE.CylinderGeometry(0.016, 0.016, barWidth, 24);
  barGeom.rotateZ(Math.PI / 2);
  const handlebar = new THREE.Mesh(barGeom, barMat);
  handlebar.position.set(0, 0.026, -0.038);
  cockpitGroup.add(handlebar);

  // Knurled Rubber Grips (Left & Right)
  const gripGeom = new THREE.CylinderGeometry(0.0195, 0.0195, 0.135, 16);
  gripGeom.rotateZ(Math.PI / 2);

  const gripL = new THREE.Mesh(gripGeom, gripMat);
  gripL.position.set(-(barWidth / 2 - 0.07), 0.026, -0.038);
  cockpitGroup.add(gripL);

  const gripR = new THREE.Mesh(gripGeom, gripMat);
  gripR.position.set(barWidth / 2 - 0.07, 0.026, -0.038);
  cockpitGroup.add(gripR);

  // Alloy Grip Lock-On Rings (Inner & Outer collars)
  const lockRingGeom = new THREE.CylinderGeometry(0.021, 0.021, 0.008, 14);
  lockRingGeom.rotateZ(Math.PI / 2);
  const lockRingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });

  const lockL1 = new THREE.Mesh(lockRingGeom, lockRingMat);
  lockL1.position.set(-(barWidth / 2 - 0.005), 0.026, -0.038);
  cockpitGroup.add(lockL1);
  const lockL2 = new THREE.Mesh(lockRingGeom, lockRingMat);
  lockL2.position.set(-(barWidth / 2 - 0.135), 0.026, -0.038);
  cockpitGroup.add(lockL2);

  const lockR1 = new THREE.Mesh(lockRingGeom, lockRingMat);
  lockR1.position.set(barWidth / 2 - 0.005, 0.026, -0.038);
  cockpitGroup.add(lockR1);
  const lockR2 = new THREE.Mesh(lockRingGeom, lockRingMat);
  lockR2.position.set(barWidth / 2 - 0.135, 0.026, -0.038);
  cockpitGroup.add(lockR2);

  // Hydraulic 4-Piston Brake Levers (Pivots on pull)
  const leverGeom = new THREE.BoxGeometry(0.09, 0.008, 0.014);

  const leftBrakeLever = new THREE.Mesh(leverGeom, brakeLeverMat);
  leftBrakeLever.position.set(-(barWidth / 2 - 0.16), 0.022, -0.062);
  leftBrakeLever.rotation.y = 0.25;
  cockpitGroup.add(leftBrakeLever);

  const rightBrakeLever = new THREE.Mesh(leverGeom, brakeLeverMat);
  rightBrakeLever.position.set(barWidth / 2 - 0.16, 0.022, -0.062);
  rightBrakeLever.rotation.y = -0.25;
  cockpitGroup.add(rightBrakeLever);

  // Carbon Knuckle Guard & Details Material
  const gloveCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.35,
    metalness: 0.6,
  });
  const gloveGripMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.9,
    metalness: 0.05,
  });

  // Function to create an articulated low-poly mountain bike glove wrapped firmly around the handlebar grip
  const createMTBGlove = (isLeft: boolean): THREE.Group => {
    const glove = new THREE.Group();

    // 1. Padded Palm / Hand Body wrapping around the bar
    const palmGeom = new THREE.BoxGeometry(0.082, 0.046, 0.068);
    const palm = new THREE.Mesh(palmGeom, gloveMat);
    palm.position.set(0, 0.008, 0.004);
    palm.rotation.x = -0.12;
    glove.add(palm);

    // 2. Carbon Knuckle Protector Plate (Top of hand)
    const knuckleGeom = new THREE.BoxGeometry(0.068, 0.016, 0.038);
    const knuckle = new THREE.Mesh(knuckleGeom, gloveCarbonMat);
    knuckle.position.set(0, 0.032, 0.002);
    knuckle.rotation.x = 0.15;
    glove.add(knuckle);

    // 3. Four Curled Fingers gripped tightly under the handlebar
    const fingersGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.076, 12);
    fingersGeom.rotateZ(Math.PI / 2);
    const fingers = new THREE.Mesh(fingersGeom, gloveGripMat);
    fingers.position.set(0, -0.012, -0.018);
    glove.add(fingers);

    // 4. Opposing Thumb hooked along inner grip & brake lever perch
    const thumbGeom = new THREE.CylinderGeometry(0.011, 0.012, 0.042, 8);
    thumbGeom.rotateZ(Math.PI / 2);
    const thumb = new THREE.Mesh(thumbGeom, gloveMat);
    const thumbSide = isLeft ? 0.036 : -0.036;
    thumb.position.set(thumbSide, -0.004, 0.016);
    thumb.rotation.y = isLeft ? -0.45 : 0.45;
    glove.add(thumb);

    // 5. Neoprene Wrist Cuff with TPR Velcro strap
    const cuffGeom = new THREE.BoxGeometry(0.076, 0.038, 0.036);
    const cuff = new THREE.Mesh(cuffGeom, gloveCarbonMat);
    cuff.position.set(0, 0.014, 0.038);
    glove.add(cuff);

    // Subtle natural inward wrist angle
    glove.rotation.z = isLeft ? -0.1 : 0.1;
    return glove;
  };

  // Left & Right MTB Gloves snapped directly onto handlebar grips
  const handL = createMTBGlove(true);
  handL.position.set(-(barWidth / 2 - 0.07), 0.026, -0.038);
  cockpitGroup.add(handL);

  const handR = createMTBGlove(false);
  handR.position.set(barWidth / 2 - 0.07, 0.026, -0.038);
  cockpitGroup.add(handR);

  // GPS Cockpit Computer with Live Canvas Texture (Mounted cleanly over stem faceplate)
  const computerCanvas = document.createElement('canvas');
  computerCanvas.width = 256;
  computerCanvas.height = 160;
  const computerTexture = new THREE.CanvasTexture(computerCanvas);
  computerTexture.anisotropy = 4;

  const computerGeom = new THREE.BoxGeometry(0.068, 0.014, 0.088);
  const computerBaseMat = new THREE.MeshStandardMaterial({ color: 0x09090b });
  const computerScreenMat = new THREE.MeshBasicMaterial({ map: computerTexture });

  const computerMesh = new THREE.Mesh(
    computerGeom,
    [computerBaseMat, computerBaseMat, computerScreenMat, computerBaseMat, computerBaseMat, computerBaseMat]
  );
  computerMesh.position.set(0, 0.046, -0.012);
  computerMesh.rotation.x = 0.42; // ergonomically angled toward rider's line of sight
  cockpitGroup.add(computerMesh);

  // Under-computer mount bracket (connects GPS securely to handlebar center)
  const mountBracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.022, 0.04),
    darkAlloyMat
  );
  mountBracket.position.set(0, 0.032, -0.024);
  cockpitGroup.add(mountBracket);

  // Function to draw crisp live dashboard telemetry on bike GPS
  const drawComputerScreen = (speed: number, alt: number, gear: number) => {
    const ctx = computerCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, 256, 160);

    // Accent header
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, 0, 256, 12);

    // Speed display
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(speed).toString(), 128, 75);

    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('KM/H', 128, 98);

    // Divider
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, 112);
    ctx.lineTo(241, 112);
    ctx.stroke();

    // Bottom Stats: Elevation & Gear
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(alt)}M`, 24, 142);

    ctx.fillStyle = '#a855f7';
    ctx.textAlign = 'right';
    ctx.fillText(`GEAR ${gear}`, 232, 142);

    computerTexture.needsUpdate = true;
  };

  drawComputerScreen(0, 380, 4);

  // Enable standard scene shadows and lighting across the entire bike hierarchy (frame, fork, cockpit, arms)
  rootGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // === 6. ANIMATION HOOKS ===
  let frameCount = 0;
  let currentFrontTravel = 0;
  let currentShockTravel = 0;
  let currentRearBrakePull = 0;
  let currentFrontBrakePull = 0;
  let currentSteer = 0;

  const updateTransforms = (
    steerAngle: number,
    frontCompression: number,
    rearCompression: number,
    wheelRot: number,
    brakePull: number, // rear brake pull
    pedalRot: number,
    speedKmh: number,
    altitude: number,
    currentGear: number,
    frontBrakePull: number = 0 // front brake pull
  ) => {
    // 1. Smooth Steer Fork along headtube axis
    currentSteer += (steerAngle - currentSteer) * 0.45;
    forkSteerGroup.rotation.y = currentSteer;

    // 2. Front Fork Travel Compression (0 to 200mm = 0 to 0.20m)
    // Travel slides fork lowers UP along the stanchions (+Y in local steer group coordinate space)
    // Standard baseline uncompressed position is -0.30m relative to lower crown
    // At full 100% compression, forkLowersGroup rises by up to 0.20m (200mm DH travel)
    const targetTravel = Math.max(0, Math.min(0.20, frontCompression * 0.20));
    currentFrontTravel += (targetTravel - currentFrontTravel) * 0.55;
    forkLowersGroup.position.y = -0.30 + currentFrontTravel;

    // 3. Wheel Spin (Rotation around local X axis)
    frontWheelGroup.rotation.x = wheelRot;
    rearWheelGroup.rotation.x = wheelRot;

    // 4. Pedal & Crank Rotation with matching pedal level attitudes
    crankGroup.rotation.x = pedalRot;
    pedalL.rotation.x = -pedalRot;
    pedalR.rotation.x = -pedalRot;

    // 5. Dual Independent Brake Levers Pull (Left = Rear, Right = Front)
    currentRearBrakePull += (brakePull - currentRearBrakePull) * 0.45;
    currentFrontBrakePull += (frontBrakePull - currentFrontBrakePull) * 0.45;
    leftBrakeLever.rotation.y = 0.25 - currentRearBrakePull * 0.16;
    rightBrakeLever.rotation.y = -0.25 + currentFrontBrakePull * 0.16;

    // 6. Articulated Rear Suspension Swingarm & Shock Compression (0 to 200mm wheel travel)
    // As the rear wheel hits bumps or the rider pumps into berms, the entire swingarm
    // arches upward around the main pivot at the bottom bracket (posBB).
    // An upward swing corresponds to positive rotation around local X axis (+pitch up)
    const targetShock = Math.max(0, Math.min(1.0, rearCompression));
    currentShockTravel += (targetShock - currentShockTravel) * 0.55;
    
    // Max swingarm rotation ~0.20 radians (~11.5 degrees) provides ~140-200mm vertical axle displacement
    swingarmGroup.rotation.x = currentShockTravel * 0.19;

    // Compresses coil spring and stanchion reservoir along local Y/Z axis
    rearShockGroup.scale.set(1.0 + currentShockTravel * 0.08, 1.0 - currentShockTravel * 0.32, 1.0 + currentShockTravel * 0.08);
    rearShockGroup.position.y = 0.52 - currentShockTravel * 0.032;

    // 7. Update GPS Screen every 6 frames
    frameCount++;
    if (frameCount % 6 === 0) {
      drawComputerScreen(speedKmh, altitude, currentGear);
    }
  };

  const updateMaterials = (cust: BikeCustomization) => {
    frameMat.color.set(cust.frame.color);
    forkLowersMat.color.set(cust.fork.color);
    rimMat.color.set(cust.wheels.rimColor);
    barMat.color.set(cust.cockpit.barColor);
    gripMat.color.set(cust.cockpit.gripColor);
    shockCoilMat.color.set(cust.shock.coilColor);
  };

  return {
    rootGroup,
    frameGroup,
    swingarmGroup,
    forkBaseGroup,
    forkSteerGroup,
    forkLowersGroup,
    frontWheelGroup,
    rearWheelGroup,
    crankGroup,
    pedalL,
    pedalR,
    rearShockGroup,
    leftBrakeLever,
    rightBrakeLever,
    computerCanvas,
    computerTexture,
    updateTransforms,
    updateMaterials,
  };
}
