import * as THREE from 'three';
import { BikeCustomization, TelemetryData, CameraView } from '../types/game';
import { GeneratedTrail, TrailPoint } from './trailGenerator';
import { soundEngine } from '../audio/soundEngine';

export interface PlayerControls {
  pedal: boolean;
  brake: boolean;
  frontBrake?: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  bunnyHop: boolean;
  tuck: boolean;
  leanBack?: boolean;
  pump?: boolean;
  whipLeft: boolean;
  whipRight: boolean;
}

export class MTBPhysics {
  // Positional state
  public trackDistance: number = 0; // meters along trail
  public lateralOffset: number = 0; // meters from centerline (-left, +right)
  public verticalOffset: number = 0; // meters above ground (when airborne)
  public verticalVelocity: number = 0; // m/s
  public speed: number = 0; // m/s (forward along track)
  
  // Rotational state
  public steerAngle: number = 0; // radians
  public leanAngle: number = 0; // bike roll in radians
  public pitchAngle: number = 0; // bike pitch in radians
  public airWhipAngle: number = 0; // mid-air whip rotation
  public wheelRotation: number = 0;
  public pedalAngle: number = 0;
  private pedalVelocity: number = 0; // Rotational velocity of pedals (rad/s)
  public currentGear: number = 4;
  public maxGear: number = 7;

  // Suspension state (0 = fully extended, 1 = fully bottomed out)
  public frontSuspensionCompression: number = 0.15;
  public rearSuspensionCompression: number = 0.20;
  private frontSuspensionVelocity: number = 0;
  private rearSuspensionVelocity: number = 0;

  // Dual independent hydraulic disc brake pressures (0 = open, 1 = locked)
  public brakePressure: number = 0; // rear brake
  public frontBrakePressure: number = 0; // front brake

  // Dirt traction, lateral slip, and drift dynamics
  public driftFactor: number = 0; // 0 = full grip, 1 = sideways drift
  public lateralGForce: number = 0;
  public currentSurface: string = 'dirt';

  // Terrain Pumping state
  public pumpCharge: number = 0;
  public pumpReady: boolean = false;
  private lastPumpTime: number = 0;

  // Status flags
  public isGrounded: boolean = true;
  public isSkidding: boolean = false;
  public isCrashed: boolean = false;
  public crashTimer: number = 0;

  // Stunt & score tracking
  public airTime: number = 0;
  public currentScore: number = 0;
  public stuntName: string = '';
  public jumpsCompleted: number = 0;
  public lastCheckpointPassed: number = -1;
  public raceStartTime: number = 0;
  public elapsedTime: number = 0;

  // Pre-load bunny hop charge
  private hopCharge: number = 0;

  // Orientation & Camera damping
  private currentOrientation: THREE.Quaternion = new THREE.Quaternion();
  private camPos: THREE.Vector3 = new THREE.Vector3();
  private camLookAt: THREE.Vector3 = new THREE.Vector3();
  private camUp: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.reset();
  }

  reset(trail?: GeneratedTrail) {
    this.trackDistance = 0;
    this.lateralOffset = 0;
    this.verticalOffset = 0;
    this.verticalVelocity = 0;
    this.speed = 0;
    this.steerAngle = 0;
    this.leanAngle = 0;
    this.pitchAngle = 0;
    this.airWhipAngle = 0;
    this.wheelRotation = 0;
    this.pedalAngle = 0;
    this.pedalVelocity = 0;
    this.brakePressure = 0;
    this.frontBrakePressure = 0;
    this.driftFactor = 0;
    this.lateralGForce = 0;
    this.currentSurface = 'dirt';
    this.pumpCharge = 0;
    this.pumpReady = false;
    this.lastPumpTime = 0;

    if (trail) {
      const tp = trail.getPointAtDistance(0);
      const tangent = tp.tangent.clone().normalize();
      const up = tp.normal.clone().normalize();
      const right = tp.binormal.clone().normalize();
      const bikeForwardAxis = tangent.clone().negate();
      const rotMat = new THREE.Matrix4();
      rotMat.makeBasis(right, up, bikeForwardAxis);
      this.currentOrientation.setFromRotationMatrix(rotMat);

      const groundPos = tp.position.clone().addScaledVector(tp.normal, 0.37);
      const eyeOffset = new THREE.Vector3(0, 1.08, 0.28).applyQuaternion(this.currentOrientation);
      this.camPos.copy(groundPos).add(eyeOffset);
      const lookTargetPt = trail.getPointAtDistance(18);
      this.camLookAt.copy(lookTargetPt.position).add(new THREE.Vector3(0, 0.88, 0));
      this.camUp.set(0, 1, 0);
    } else {
      this.currentOrientation.set(0, 0, 0, 1);
    }
    this.currentGear = 4;
    this.frontSuspensionCompression = 0.15;
    this.rearSuspensionCompression = 0.20;
    this.frontSuspensionVelocity = 0;
    this.rearSuspensionVelocity = 0;
    this.isGrounded = true;
    this.isSkidding = false;
    this.isCrashed = false;
    this.crashTimer = 0;
    this.airTime = 0;
    this.currentScore = 0;
    this.stuntName = '';
    this.jumpsCompleted = 0;
    this.lastCheckpointPassed = -1;
    this.raceStartTime = performance.now();
    this.elapsedTime = 0;
    this.hopCharge = 0;
  }

  update(
    delta: number,
    controls: PlayerControls,
    bike: BikeCustomization,
    trail: GeneratedTrail
  ): void {
    if (this.isCrashed) {
      this.crashTimer += delta;
      this.speed = Math.max(0, this.speed - 15 * delta);
      if (this.crashTimer > 2.2) {
        // Recover from crash onto track
        this.isCrashed = false;
        this.crashTimer = 0;
        this.lateralOffset = 0;
        this.verticalOffset = 0;
        this.verticalVelocity = 0;
        this.speed = 5;
      }
      return;
    }

    // Cap delta for frame spikes
    const dt = Math.min(delta, 0.05);
    this.elapsedTime += dt;

    const trailPoint = trail.getPointAtDistance(this.trackDistance);
    this.currentSurface = trailPoint.surface || 'dirt';

    // Dynamic downhill slope calculation
    // grade in radians: positive grade means descending downhill along travel direction
    const gradeRad = (trailPoint.grade * Math.PI) / 180;
    const slopeSin = Math.sin(gradeRad);

    // Surface friction coefficients & rolling resistances
    let surfaceGripCoeff = 0.92;
    let surfaceRollingCoeff = 0.016;
    if (trailPoint.surface === 'rock' || trailPoint.type === 'rock_garden') {
      surfaceGripCoeff = 0.52; // Slick, rough rock slabs
      surfaceRollingCoeff = 0.038;
    } else if (trailPoint.surface === 'loose_gravel') {
      surfaceGripCoeff = 0.64; // Skiddy gravel scree
      surfaceRollingCoeff = 0.026;
    } else if (trailPoint.surface === 'wood' || trailPoint.type === 'wood_bridge') {
      surfaceGripCoeff = 0.60;
      surfaceRollingCoeff = 0.014;
    }

    // --- 1. DUAL INDEPENDENT HYDRAULIC DISC BRAKING & WEIGHT BIAS ---
    // Rear Brake (S / Down Arrow / Brake button): Progressive modulation, speed control, induces drift
    const rearBrakeActive = (controls.brake || false) && this.isGrounded;
    if (rearBrakeActive) {
      this.brakePressure = Math.min(1.0, this.brakePressure + dt * 4.2);
    } else {
      this.brakePressure = Math.max(0, this.brakePressure - dt * 6.0);
    }

    // Front Brake (X / Front Brake button): Up to 70% stopping authority, compresses fork, risks OTB if overclamped on steep downhills
    const frontBrakeActive = (controls.frontBrake || false) && this.isGrounded;
    if (frontBrakeActive) {
      this.frontBrakePressure = Math.min(1.0, this.frontBrakePressure + dt * 4.8);
    } else {
      this.frontBrakePressure = Math.max(0, this.frontBrakePressure - dt * 6.5);
    }

    // Combined brake deceleration with physical front/rear split
    const rearForceScalar = 0.35 * (0.3 * this.brakePressure + 0.7 * Math.pow(this.brakePressure, 2.0));
    const frontForceScalar = 0.65 * (0.25 * this.frontBrakePressure + 0.75 * Math.pow(this.frontBrakePressure, 2.2));
    const totalBrakeForceScalar = rearForceScalar + frontForceScalar;
    const maxBrakeDecel = (14.0 + 8.5 * bike.brakes.power) * totalBrakeForceScalar;
    const brakeDecel = this.isGrounded ? maxBrakeDecel : 0;

    // Rider fore-aft weight position:
    // tuck = forward attack position (+weight on front wheel for cornering grip)
    // leanBack = backwards weight shift (-weight on fork to prevent OTB and absorb drops)
    const weightBias = controls.tuck ? 0.22 : (controls.leanBack ? -0.28 : 0.0);

    // --- 2. ADVANCED SUSPENSION DYNAMICS (NON-LINEAR PROGRESSIVE DUAL SPRING-DAMPER) ---
    // Downhill MTB suspension: 200mm front fork, 200mm rear travel with coil/air progression
    const forkBaseStiffness = 62 * bike.fork.stiffness;
    const forkDamping = 12 * bike.fork.damping;
    const shockBaseStiffness = 56 * bike.shock.reboundDamping;
    const shockDamping = 14 * bike.shock.reboundDamping;

    // Dynamic forward weight transfer under braking (Fork Dive effect)
    // Front brake induces intense fork dive; rear brake induces mild dive and chassis squat
    const frontBrakeDive = (this.frontBrakePressure * 0.42) + (this.brakePressure * 0.14);
    const weightTransferDive = frontBrakeDive + weightBias * 0.22;

    // Acceleration / slope weight shift (rear squat on steep uphill or hard pedaling)
    const slopePitchShift = Math.max(-0.18, Math.min(0.18, -slopeSin * 0.28));

    // Realistic terrain surface elevation sampling for front and rear wheel contact patches
    // Front axle is +0.72m ahead along track, rear axle is -0.62m behind along track
    let frontBump = 0;
    let rearBump = 0;
    if (this.isGrounded) {
      const speedRatio = Math.min(1.0, this.speed / 6);
      
      // Calculate local surface variations from track ribbon
      if (trail.getTrackSurfacePoint) {
        const frontPt = trail.getTrackSurfacePoint(this.trackDistance + 0.72, this.lateralOffset);
        const rearPt = trail.getTrackSurfacePoint(Math.max(0, this.trackDistance - 0.62), this.lateralOffset);
        frontBump += frontPt.elevationOffset * 0.8;
        rearBump += rearPt.elevationOffset * 0.8;
      }

      if (trailPoint.surface === 'rock' || trailPoint.type === 'rock_garden') {
        frontBump += (Math.sin(this.trackDistance * 26) * 0.12 + Math.cos(this.trackDistance * 48) * 0.08) * speedRatio;
        rearBump += (Math.sin((this.trackDistance - 1.34) * 26) * 0.12 + Math.cos((this.trackDistance - 1.34) * 48) * 0.08) * speedRatio;
      } else if (trailPoint.surface === 'loose_gravel') {
        frontBump += (Math.sin(this.trackDistance * 38) * 0.045 + Math.cos(this.trackDistance * 72) * 0.025) * speedRatio;
        rearBump += (Math.sin((this.trackDistance - 1.34) * 38) * 0.045 + Math.cos((this.trackDistance - 1.34) * 72) * 0.025) * speedRatio;
      } else {
        // Packed dirt with washboard braking bumps into corners
        frontBump += (Math.sin(this.trackDistance * 18) * 0.035 + Math.cos(this.trackDistance * 32) * 0.02) * speedRatio;
        rearBump += (Math.sin((this.trackDistance - 1.34) * 18) * 0.035 + Math.cos((this.trackDistance - 1.34) * 32) * 0.02) * speedRatio;
      }

      // Discrete physical obstacle collisions with trail rocks
      if (trail.obstacles && trail.obstacles.length > 0) {
        for (let o = 0; o < trail.obstacles.length; o++) {
          const obs = trail.obstacles[o];
          const distDiff = Math.abs(this.trackDistance - obs.distance);
          if (distDiff < obs.radius + 0.6) {
            const latDiff = Math.abs(this.lateralOffset - obs.lateralOffset);
            if (latDiff < obs.radius) {
              const impactIntensity = (1.0 - latDiff / obs.radius) * (1.0 - distDiff / (obs.radius + 0.6));
              // Direct hit on jagged boulder at high speed triggers crash or severe deflection
              if (impactIntensity > 0.75 && this.speed > 16.5 && !controls.bunnyHop) {
                this.triggerCrash('Struck Rock Slab at Speed!');
                return;
              }
              // Absorbed shock deflection
              frontBump += obs.height * 2.2 * impactIntensity;
              rearBump += obs.height * 1.8 * impactIntensity;
              this.speed *= Math.max(0.70, 1.0 - 0.22 * impactIntensity);
              soundEngine.playLandingThump(Math.min(1.0, impactIntensity * 1.8));
              break;
            }
          }
        }
      }
    }

    // --- 2B. MTB DOWNHILL PUMP MECHANIC ---
    // Downhill riders generate speed by pumping into berm transitions, rollers, and downslope troughs
    const canPump = this.isGrounded && slopeSin > 0.05 && this.speed > 4.0;
    this.pumpReady = canPump;

    let pumpBoost = 0;
    if (controls.pump && this.isGrounded) {
      const now = performance.now();
      if (now - this.lastPumpTime > 650) { // Cooldown between deliberate pumps
        this.lastPumpTime = now;
        // Pumping efficiency is higher on downslopes and berms
        const slopeBonus = Math.max(0.2, slopeSin * 2.2);
        const pumpSpeedBonus = 1.8 + slopeBonus * 1.5;
        pumpBoost = pumpSpeedBonus;
        soundEngine.playPumpSurge();
        this.stuntName = 'PUMP BOOST +' + (pumpSpeedBonus * 3.6).toFixed(0) + ' KM/H';
        this.currentScore += 50;
        // Dynamic suspension compression under rider pump extension
        this.frontSuspensionCompression = Math.min(0.95, this.frontSuspensionCompression + 0.38);
        this.rearSuspensionCompression = Math.min(0.95, this.rearSuspensionCompression + 0.42);
        this.frontSuspensionVelocity += 3.5;
        this.rearSuspensionVelocity += 3.8;
      }
    }

    // Front fork target compression: baseline sag (~25% of 200mm = 50mm) + brake dive + bumps
    const targetFrontComp = this.isGrounded
      ? Math.max(0.06, Math.min(0.98, 0.25 + weightTransferDive - slopePitchShift + frontBump))
      : 0.02; // Droop in air (unweighted stanchion extension)

    const frontDisplacement = targetFrontComp - this.frontSuspensionCompression;
    // Non-linear bottom-out resistance (ramping air spring / hydraulic bottom-out cone)
    const frontProgressiveFactor = 1.0 + 3.8 * Math.pow(this.frontSuspensionCompression, 3.2);
    const frontAccel = frontDisplacement * (forkBaseStiffness * frontProgressiveFactor) - this.frontSuspensionVelocity * forkDamping;
    this.frontSuspensionVelocity += frontAccel * dt;
    this.frontSuspensionVelocity *= Math.exp(-3.2 * dt);
    this.frontSuspensionCompression = Math.max(0.0, Math.min(1.0, this.frontSuspensionCompression + this.frontSuspensionVelocity * dt));

    // Rear shock target compression: baseline sag (~28% of 200mm)
    const pedalBob = (controls.pedal && this.isGrounded) ? Math.abs(Math.sin(this.pedalAngle * 2)) * 0.07 : 0;
    const targetRearComp = this.isGrounded
      ? Math.max(0.06, Math.min(0.98, 0.28 - (weightTransferDive * 0.45) - (weightBias * 0.22) + slopePitchShift + pedalBob + rearBump))
      : 0.02; // Droop in air
    const rearDisplacement = targetRearComp - this.rearSuspensionCompression;
    const rearProgressiveFactor = 1.0 + 4.2 * Math.pow(this.rearSuspensionCompression, 3.2);
    const rearAccel = rearDisplacement * (shockBaseStiffness * rearProgressiveFactor) - this.rearSuspensionVelocity * shockDamping;
    this.rearSuspensionVelocity += rearAccel * dt;
    this.rearSuspensionVelocity *= Math.exp(-3.2 * dt);
    this.rearSuspensionCompression = Math.max(0.0, Math.min(1.0, this.rearSuspensionCompression + this.rearSuspensionVelocity * dt));

    // Check for hard bottom-out (>96% stroke travel)
    if (this.isGrounded && (this.frontSuspensionCompression > 0.96 || this.rearSuspensionCompression > 0.96)) {
      if (Math.abs(this.frontSuspensionVelocity) > 2.0 || Math.abs(this.rearSuspensionVelocity) > 2.0) {
        soundEngine.playBottomOut(0.85);
      }
    }

    // Fast rebound / high-velocity compression acoustic oil hiss
    if (Math.abs(this.frontSuspensionVelocity) > 2.6 && this.isGrounded) {
      soundEngine.playSuspensionHiss(Math.min(1.0, Math.abs(this.frontSuspensionVelocity) / 5.5));
    }

    // Dynamic frame pitch angle computed from suspension difference + rider bias
    this.pitchAngle = (this.frontSuspensionCompression - this.rearSuspensionCompression) * 0.30 + weightBias * 0.14;

    // --- 2C. OVER-THE-BARS (OTB) DANGER CHECK ---
    // If rider clamps front brake at high speed on a steep descent without leaning back
    if (this.isGrounded && this.speed > 13.0 && this.frontBrakePressure > 0.88 && slopeSin > 0.25 && !controls.leanBack) {
      this.triggerCrash('Over-The-Bars! (Lean back on steep drops)');
      return;
    }

    // --- 3. JUMP ARC & AIR CONTROL (PARABOLIC LAUNCH & HOP BUTTON) ---
    // Bunny hop preload (crouching compresses suspension down, release pops bike skyward)
    if (controls.bunnyHop && this.isGrounded) {
      this.hopCharge = Math.min(1.0, this.hopCharge + dt * 3.2);
      // Preload squash
      this.frontSuspensionCompression = Math.min(0.95, this.frontSuspensionCompression + this.hopCharge * 0.35);
      this.rearSuspensionCompression = Math.min(0.95, this.rearSuspensionCompression + this.hopCharge * 0.35);
    } else if (!controls.bunnyHop && this.hopCharge > 0.15 && this.isGrounded) {
      // Release hop: Launch with true parabolic vertical velocity v_y0
      const popStrength = 3.6 + this.hopCharge * 4.6;
      this.verticalVelocity = popStrength;
      this.isGrounded = false;
      this.hopCharge = 0;
      soundEngine.playJumpLaunch();
    } else {
      this.hopCharge = 0;
    }

    // --- 4. CORNERING, COMBINED TRACTION CIRCLE (PACEJKA / COULOMB) & BIKE LEAN ---
    const steerSpeed = (bike.cockpit.barWidth / 800) * 5.2;
    let targetSteer = 0;
    if (controls.steerLeft) targetSteer -= 0.44;
    if (controls.steerRight) targetSteer += 0.44;

    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1.0, steerSpeed * dt * 7);

    // Calculate lateral acceleration / cornering G-Force: a_lat = v * d_psi/dt
    const effectiveSpeed = Math.max(1.0, this.speed);
    const lateralTurnRate = this.steerAngle * (effectiveSpeed * 0.45);
    this.lateralGForce = Math.abs(lateralTurnRate) / 9.81;

    // Combined tire grip circle: F_lat^2 + F_long^2 <= (mu * N)^2
    // Surface coefficient (dirt 0.92, gravel 0.64, rock 0.52) scales the available grip
    const compoundGrip = (bike.tires.grip * 0.6 + 0.4) * surfaceGripCoeff;
    // Front brake consumes front tire grip; rear brake breaks rear tire loose easily
    const brakeGripDeduction = (this.brakePressure * 0.32) + (this.frontBrakePressure * 0.45);
    const effectiveGripLimit = Math.max(0.20, (0.58 * compoundGrip) - brakeGripDeduction);

    const speedKmhNow = this.speed * 3.6;
    if (this.isGrounded && speedKmhNow > 20 && this.lateralGForce > effectiveGripLimit) {
      const overGrip = (this.lateralGForce - effectiveGripLimit) * 2.2;
      this.driftFactor = Math.min(1.0, this.driftFactor + overGrip * dt * 4.5);
    } else {
      this.driftFactor = Math.max(0, this.driftFactor - dt * 4.5);
    }

    // High-speed front tire washout crash: sharp steering at > 45 km/h on slick rock/gravel with locked front brake
    if (this.isGrounded && speedKmhNow > 42 && this.frontBrakePressure > 0.8 && Math.abs(this.steerAngle) > 0.30 && surfaceGripCoeff < 0.65) {
      this.triggerCrash('Front Wheel Washout on Slick Terrain!');
      return;
    }

    // Skid state triggered by rear brake lock, heavy front brake clamp, or hard drift
    this.isSkidding = (this.brakePressure > 0.60 && this.speed > 4) || (this.frontBrakePressure > 0.70 && this.speed > 6) || (this.driftFactor > 0.30);

    // Lateral movement across track width with drift slip
    const driftMultiplier = 1.0 + this.driftFactor * 0.75;
    const lateralSpeed = this.steerAngle * (this.speed * 0.88 + 2.0) * driftMultiplier;
    this.lateralOffset += lateralSpeed * dt;

    // Track boundary constraint with berm rebound
    const halfWidth = trailPoint.width * 0.5;
    if (Math.abs(this.lateralOffset) > halfWidth * 1.35) {
      if (this.speed > 13) {
        this.triggerCrash('Clipped Trail Edge!');
        return;
      } else {
        this.lateralOffset = Math.sign(this.lateralOffset) * halfWidth * 1.35;
        this.speed *= 0.65;
      }
    }

    // Dynamic Bike Lean Angle & Camera Roll
    // Physics lean: phi = atan(v^2 / (g * R)) modulated by trail berm banking
    const dynamicLeanTarget = -Math.atan2(lateralTurnRate * 0.32, 1.0) * 1.35 + (trailPoint.bankAngle * 0.75);
    const maxLean = (38 * Math.PI) / 180; // Up to 38 degrees bike roll in high-speed berms
    const clampedLean = Math.max(-maxLean, Math.min(maxLean, dynamicLeanTarget));
    this.leanAngle += (clampedLean - this.leanAngle) * Math.min(1.0, 9.5 * dt);

    // --- 5. MOMENTUM CONSERVATION, SLOPE GRAVITY & SPEED INTEGRATION ---
    let gravityAccel = 9.81 * slopeSin * 1.12;

    // Hold bike steady at starting line until rider pedals or hops
    if (this.trackDistance < 1.5 && !controls.pedal && !controls.bunnyHop && this.speed < 0.5) {
      gravityAccel = 0;
      this.speed = 0;
    }

    // Pedal propulsion & rotational cadence
    let pedalAccel = 0;
    if (controls.pedal && this.isGrounded) {
      const gearRatio = this.currentGear / this.maxGear;
      const pedalMaxSpeed = 15 + gearRatio * 18;
      if (this.speed < pedalMaxSpeed) {
        pedalAccel = (1.0 - (this.speed / pedalMaxSpeed)) * 5.8 * (compoundGrip * 0.4 + 0.6);
      }
      const targetCadence = (this.speed + 6) * 3.8;
      this.pedalVelocity += (targetCadence - this.pedalVelocity) * Math.min(1.0, 10 * dt);
    } else {
      this.pedalVelocity *= Math.exp(-3.0 * dt);
    }
    this.pedalAngle += this.pedalVelocity * dt;

    // Aerodynamic Drag: F_drag = 0.5 * rho * Cd * A * v^2
    const dragCoeff = controls.tuck ? 0.0016 : (controls.leanBack ? 0.0038 : 0.0032);
    const aeroDrag = dragCoeff * this.speed * this.speed;

    // Rolling Resistance: C_rr * g * (1 + v/100) scaled by terrain surface
    const rollingCoeff = surfaceRollingCoeff + bike.tires.rollingResistance * 0.018;
    const rollingResistance = this.isGrounded ? rollingCoeff * 9.81 * (1.0 + this.speed * 0.015) : 0;

    // Drift scrubbing deceleration: turning sideways scrubs kinetic energy
    const driftScrub = this.driftFactor * 3.4;

    // Net acceleration integrating gravity, pedaling, pump boost, aero drag, rolling resistance, and progressive braking
    const netAccel = gravityAccel + pedalAccel - aeroDrag - rollingResistance - brakeDecel - driftScrub;
    this.speed = Math.max(0, this.speed + (netAccel * dt) + (pumpBoost * dt * 4.0));

    // Automatic electronic gear indexing
    if (this.speed > 16.5 && this.currentGear < this.maxGear) {
      this.currentGear++;
      soundEngine.playGearShift();
    } else if (this.speed < 10.5 && this.currentGear > 2) {
      this.currentGear--;
      soundEngine.playGearShift();
    }

    // Distance progression & wheel spin
    this.trackDistance += this.speed * dt;
    this.wheelRotation -= (this.speed / 0.36) * dt;

    // --- 6. VERTICAL TRAIL PROFILE & PARABOLIC AIR TRAJECTORY ---
    // Check for terrain drop-offs and jump kickers
    const nextPt = trail.getPointAtDistance(this.trackDistance + 0.5);
    const dropRate = (trailPoint.position.y - nextPt.position.y) / 0.5;

    if (trailPoint.type === 'jump' && this.isGrounded && this.speed > 8) {
      // Kicker launch: convert forward speed into upward vertical launch velocity
      this.verticalVelocity = Math.max(this.verticalVelocity, this.speed * 0.32 + 3.2);
      this.isGrounded = false;
      this.jumpsCompleted++;
      soundEngine.playJumpLaunch();
    } else if (trailPoint.type === 'drop' && this.isGrounded && dropRate > 1.25) {
      // Drop-off sender
      this.verticalVelocity = Math.max(this.verticalVelocity, 1.8);
      this.isGrounded = false;
      this.jumpsCompleted++;
      soundEngine.playJumpLaunch();
    }

    if (!this.isGrounded) {
      this.airTime += dt;

      // Parabolic jump arc under gravity: v_y = v_0 - g * dt
      const airGravity = 12.8; // Downhill air gravity tuned for floaty, controllable airs
      this.verticalVelocity -= airGravity * dt;
      this.verticalOffset += this.verticalVelocity * dt;

      // Mid-air stabilization & whip tricks
      if (controls.whipLeft) {
        this.airWhipAngle = Math.max(-0.65, this.airWhipAngle - 2.8 * dt);
        this.stuntName = 'TURNDOWN WHIP';
        this.currentScore += Math.round(180 * dt);
      } else if (controls.whipRight) {
        this.airWhipAngle = Math.min(0.65, this.airWhipAngle + 2.8 * dt);
        this.stuntName = 'NAC-NAC WHIP';
        this.currentScore += Math.round(180 * dt);
      } else {
        // Natural air self-centering
        this.airWhipAngle *= Math.exp(-3.5 * dt);
      }

      // Touchdown landing detection
      if (this.verticalOffset <= 0) {
        const impactVel = Math.abs(this.verticalVelocity);
        this.verticalOffset = 0;
        this.verticalVelocity = 0;
        this.isGrounded = true;

        // Satisfying tire thud and suspension hiss
        soundEngine.playLandingThump(impactVel);

        // Realistic suspension compression squash on landing
        const squashAmount = Math.min(0.85, impactVel * 0.16);
        this.frontSuspensionCompression = Math.min(1.0, this.frontSuspensionCompression + squashAmount);
        this.rearSuspensionCompression = Math.min(1.0, this.rearSuspensionCompression + squashAmount * 1.15);
        this.frontSuspensionVelocity = -impactVel * 4.2;
        this.rearSuspensionVelocity = -impactVel * 4.8;

        if (impactVel > 6.0) {
          soundEngine.playBottomOut(Math.min(1.0, impactVel / 8.0));
        }

        // Crash detection if landing with extreme sideways whip (> 34 degrees) on hard impact
        if (Math.abs(this.airWhipAngle) > 0.58 && impactVel > 7.5) {
          this.triggerCrash('Sideways Landing Crash!');
        } else if (this.airTime > 0.7) {
          // Clean jump landing bonus
          const jumpBonus = Math.round(this.airTime * 300);
          this.currentScore += jumpBonus;
          this.stuntName = `CLEAN STOMP +${jumpBonus}`;
        }
        this.airTime = 0;
      }
    } else {
      this.verticalOffset = 0;
      this.verticalVelocity = 0;
      this.airWhipAngle *= 0.85;
      if (this.airTime === 0 && !controls.whipLeft && !controls.whipRight) {
        if (Math.random() < 0.03) this.stuntName = '';
      }
    }

    // --- 6. CHECKPOINT TRIGGERS ---
    trail.checkpoints.forEach((cpDist, idx) => {
      if (this.trackDistance >= cpDist && this.lastCheckpointPassed < idx) {
        this.lastCheckpointPassed = idx;
        soundEngine.playCheckpoint();
      }
    });

    // Update sound engine continuous dynamics
    const speedKmh = this.speed * 3.6;
    soundEngine.update(
      speedKmh,
      this.isGrounded,
      controls.pedal,
      controls.brake || !!controls.frontBrake,
      this.isSkidding,
      Math.abs(this.frontSuspensionVelocity)
    );
  }

  triggerCrash(reason: string) {
    this.isCrashed = true;
    this.crashTimer = 0;
    this.stuntName = reason;
    soundEngine.playCrash();
  }

  // Update bike 3D mesh matrix and return camera orientation
  updateBikeAndCamera(
    bikeGroup: THREE.Group,
    trail: GeneratedTrail,
    camera: THREE.Camera,
    cameraView: CameraView,
    dt: number = 0.016
  ) {
    // Query exact 3D surface point and normal from trail ribbon cross-section
    const surface = trail.getTrackSurfacePoint
      ? trail.getTrackSurfacePoint(this.trackDistance, this.lateralOffset)
      : {
          position: trail.getPointAtDistance(this.trackDistance).position.clone().addScaledVector(trail.getPointAtDistance(this.trackDistance).binormal, this.lateralOffset),
          normal: trail.getPointAtDistance(this.trackDistance).normal.clone(),
          elevationOffset: 0,
        };

    const tp = trail.getPointAtDistance(this.trackDistance);

    // Compute bike 3D world position
    // Base hub elevation is 0.37m (29er wheel radius 0.37m matches rim + high-volume DH casing)
    // Suspension compression pulls axles towards chassis, effectively lowering the bottom bracket towards ground
    const dynamicSuspensionSag = (this.frontSuspensionCompression * 0.10 + this.rearSuspensionCompression * 0.10);
    const contactElevation = Math.max(0.24, 0.37 - dynamicSuspensionSag);

    const groundPos = surface.position.clone()
      .addScaledVector(surface.normal, this.verticalOffset + contactElevation);

    bikeGroup.position.copy(groundPos);

    // Bike orientation:
    // In Three.js and our bike model:
    // Bike forward is -Z
    // Bike right is +X
    // Bike up is +Y
    // Along trail curve:
    // Tangent points along the trail direction of travel
    // Surface normal provides true camber perpendicular to banked berms
    const tangent = tp.tangent.clone().normalize();
    const up = surface.normal.clone().normalize();
    // Cross product: tangent x up gives perpendicular right vector
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    // Orthonormalize up vector
    const correctedUp = new THREE.Vector3().crossVectors(right, tangent).normalize();

    // To have Bike -Z point along tangent (forward), Bike +Z must be -tangent.
    // Matrix basis: [right (+X), correctedUp (+Y), -tangent (+Z)]
    const bikeForwardAxis = tangent.clone().negate();
    const rotMat = new THREE.Matrix4();
    rotMat.makeBasis(right, correctedUp, bikeForwardAxis);
    
    // Target quaternion along trail
    const targetBaseQuat = new THREE.Quaternion().setFromRotationMatrix(rotMat);

    // Apply dynamic pitch angle from suspension dive / bunny hop preload
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitchAngle);
    targetBaseQuat.multiply(pitchQuat);

    // Apply lean angle around bike forward axis (-tangent)
    const leanQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.leanAngle);
    targetBaseQuat.multiply(leanQuat);

    // Apply mid-air whip
    if (!this.isGrounded) {
      const whipQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.airWhipAngle);
      targetBaseQuat.multiply(whipQuat);
    }

    // Smooth spherical slerp to eliminate orientation jitter
    if (this.currentOrientation.lengthSq() < 0.5) {
      this.currentOrientation.copy(targetBaseQuat);
    } else {
      const slerpSpeed = 1.0 - Math.exp(-22 * dt);
      this.currentOrientation.slerp(targetBaseQuat, slerpSpeed);
    }
    bikeGroup.quaternion.copy(this.currentOrientation);

    // --- CAMERA POSITIONING ---
    const bikeQuat = bikeGroup.quaternion.clone();

    // Damped vertical suspension offset transmitted to rider's head
    // Suspensions absorb ground jarring: only a fraction of high frequency displacement reaches helmet
    const suspensionAbsorbedOffset = -(this.frontSuspensionCompression * 0.08 + this.rearSuspensionCompression * 0.06);

    if (cameraView === 'first_person_helmet') {
      // First Person Helmet Cam: 1.08m above BB/cranks, anchored 0.28m behind handlebars (+Z in local bike space)
      // Absorbed suspension motion smoothly sinks/rises with fork dive and bumps
      const eyeOffset = new THREE.Vector3(0, 1.08 + suspensionAbsorbedOffset, 0.28).applyQuaternion(bikeQuat);
      const targetEyePos = groundPos.clone().add(eyeOffset);

      // Add subtle speed vibrations without abrupt jerking
      const chatterAmp = this.isGrounded && this.speed > 8 ? 0.004 : 0;
      const chatter = new THREE.Vector3(
        (Math.sin(this.trackDistance * 20) + Math.cos(this.trackDistance * 32)) * chatterAmp,
        (Math.cos(this.trackDistance * 26)) * chatterAmp,
        0
      );

      const camFollowSpeed = 1.0 - Math.exp(-22 * dt);
      this.camPos.lerp(targetEyePos.add(chatter), camFollowSpeed);

      // Look direction: ahead along track with rider head anticipation
      const lookLeadDist = 18 + this.speed * 0.6;
      const lookTargetPt = trail.getPointAtDistance(this.trackDistance + lookLeadDist);
      const targetLookAt = lookTargetPt.position.clone()
        .addScaledVector(lookTargetPt.binormal, this.lateralOffset * 0.6)
        .add(new THREE.Vector3(0, 0.82, 0));

      const lookFollowSpeed = 1.0 - Math.exp(-15 * dt);
      this.camLookAt.lerp(targetLookAt, lookFollowSpeed);

      // Head roll and dynamic camera banking:
      // The camera rolls with bike lean while keeping natural horizon awareness (counter-roll)
      const riderHeadRoll = this.leanAngle * 0.65 + tp.bankAngle * 0.35;
      const targetUp = new THREE.Vector3(0, 1, 0).applyAxisAngle(tp.tangent, riderHeadRoll);
      this.camUp.lerp(targetUp, 1.0 - Math.exp(-14 * dt));

      camera.position.copy(this.camPos);
      camera.up.copy(this.camUp);
      camera.lookAt(this.camLookAt);

      // Speed FOV warp (GoPro wide angle: 75 deg base -> 88 deg at 70+ km/h)
      if (camera instanceof THREE.PerspectiveCamera) {
        const targetFov = 75 + Math.min(15, (this.speed * 3.6 / 70) * 15);
        camera.fov += (targetFov - camera.fov) * (1.0 - Math.exp(-6 * dt));
        camera.updateProjectionMatrix();
      }
    } else if (cameraView === 'first_person_stem') {
      // Handlebar Stem Mount: directly mounted above top crown and stem plate, looking straight down the front wheel
      const stemOffset = new THREE.Vector3(0, 0.98 + suspensionAbsorbedOffset, -0.22).applyQuaternion(bikeQuat);
      const targetStemPos = groundPos.clone().add(stemOffset);
      this.camPos.lerp(targetStemPos, 1.0 - Math.exp(-25 * dt));
      camera.position.copy(this.camPos);
      const lookTarget = groundPos.clone().add(new THREE.Vector3(0, 0.82, -14).applyQuaternion(bikeQuat));
      this.camLookAt.lerp(lookTarget, 1.0 - Math.exp(-20 * dt));
      camera.lookAt(this.camLookAt);
    } else {
      // Third-Person Chase Cam: behind (+Z in local bike space) and above (+Y)
      const chaseOffset = new THREE.Vector3(0, 1.6, 3.8).applyQuaternion(bikeQuat);
      const targetChasePos = groundPos.clone().add(chaseOffset);
      this.camPos.lerp(targetChasePos, 1.0 - Math.exp(-10 * dt));
      camera.position.copy(this.camPos);
      const targetLook = groundPos.clone().add(new THREE.Vector3(0, 0.75, -1.8).applyQuaternion(bikeQuat));
      this.camLookAt.lerp(targetLook, 1.0 - Math.exp(-14 * dt));
      camera.lookAt(this.camLookAt);
    }
  }

  getTelemetry(trail: GeneratedTrail): TelemetryData {
    const tp = trail.getPointAtDistance(this.trackDistance);
    const speedKmh = this.speed * 3.6;
    const speedMph = this.speed * 2.237;

    // Total G-force calculation combining gravity normal, braking force, and lateral centripetal acceleration
    const verticalG = this.isGrounded ? 1.0 : Math.max(0, 1.0 + this.verticalVelocity / 9.81);
    const brakeG = (this.brakePressure * 0.8);
    const totalG = Math.sqrt(verticalG * verticalG + this.lateralGForce * this.lateralGForce + brakeG * brakeG);

    return {
      speedKmh,
      speedMph,
      rpm: Math.round(this.speed * 18),
      gear: this.currentGear,
      maxGear: this.maxGear,
      cadence: Math.round(this.speed * 4.2),
      elevation: Math.round(tp.position.y),
      elevationDrop: Math.round(trail.getPointAtDistance(0).position.y - tp.position.y),
      gradePercentage: Math.round(Math.tan((tp.grade * Math.PI) / 180) * 100),
      frontForkTravelPercent: Math.max(0, Math.min(1.0, this.frontSuspensionCompression)),
      rearShockTravelPercent: Math.max(0, Math.min(1.0, this.rearSuspensionCompression)),
      gForce: Number(totalG.toFixed(1)),
      leanAngleDeg: Math.round((this.leanAngle * 180) / Math.PI),
      isGrounded: this.isGrounded,
      airTimeSeconds: Number(this.airTime.toFixed(2)),
      jumpCount: this.jumpsCompleted,
      distanceCoveredMeters: Math.round(this.trackDistance),
      totalDistanceMeters: Math.round(trail.totalLength),
      progressPercent: Math.min(100, Math.round((this.trackDistance / trail.totalLength) * 100)),
      elapsedTime: Number(this.elapsedTime.toFixed(2)),
      currentCheckPoint: Math.max(0, this.lastCheckpointPassed + 1),
      totalCheckPoints: trail.checkpoints.length,
      crashState: this.isCrashed,
      score: this.currentScore,
      streak: Math.min(10, Math.floor(this.currentScore / 500)),
      stuntName: this.stuntName,
      surfaceName: this.currentSurface,
      frontBrakePressure: this.frontBrakePressure,
      rearBrakePressure: this.brakePressure,
      driftPercent: Math.round(this.driftFactor * 100),
      pumpReady: this.pumpReady,
    };
  }
}
