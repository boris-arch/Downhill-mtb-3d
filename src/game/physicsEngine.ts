import * as THREE from 'three';
import { BikeCustomization, TelemetryData, CameraView, GateApproachInfo } from '../types/game';
import { GeneratedTrail } from './trailGenerator';
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

type SurfaceType = 'dirt' | 'rock' | 'loose_gravel' | 'wood' | 'grass';

interface WheelRayState {
  restLength: number;
  travel: number;
  radius: number;
  compression: number;
  compressionVelocity: number;
  springRate: number;
  dampingRate: number;
  reboundRate: number;
  bottomOutForce: number;
  stiction: number;
  contactPoint: THREE.Vector3;
  contactNormal: THREE.Vector3;
  groundHeight: number;
  surface: SurfaceType;
  worldPos: THREE.Vector3;
  worldVel: THREE.Vector3;
  force: number;
  penetration: number;
}

export class MTBPhysics {
  public trackDistance = 0;
  public lateralOffset = 0;
  public verticalOffset = 0;
  public verticalVelocity = 0;
  public speed = 0;
  public steerAngle = 0;
  public leanAngle = 0;
  public pitchAngle = 0;
  public airWhipAngle = 0;
  public wheelRotation = 0;
  public pedalAngle = 0;
  public currentGear = 4;
  public maxGear = 7;
  public frontSuspensionCompression = 0.15;
  public rearSuspensionCompression = 0.2;
  public brakePressure = 0;
  public frontBrakePressure = 0;
  public driftFactor = 0;
  public lateralGForce = 0;
  public currentSurface = 'dirt';
  public pumpReady = false;
  public isGrounded = true;
  public isSkidding = false;
  public isCrashed = false;
  public crashTimer = 0;
  public airTime = 0;
  public currentScore = 0;
  public stuntName = '';
  public jumpsCompleted = 0;
  public lastCheckpointPassed = -1;
  public raceStartTime = 0;
  public elapsedTime = 0;

  public isOffTrack = false;
  public offTrackTimer = 0;
  public isRespawning = false;
  public respawnTimer = 0;
  public invulnerableTimer = 0;
  public isFinished = false;
  public currentCameraRoll = 0;
  public worldAltitude = 0;
  public worldVerticalVelocity = 0;
  public activeSplitDelta: { splitIndex: number; deltaSeconds: number; isAhead: boolean } | null = null;
  public splitDeltaTimer = 0;
  public activeApproachingGate: GateApproachInfo | null = null;
  private passedGateCues = new Set<number>();

  public debugOverlayEnabled = false;
  public debugInfo = {
    frontCompression: 0,
    rearCompression: 0,
    frontPenetration: 0,
    rearPenetration: 0,
    surface: 'dirt' as SurfaceType,
    isGrounded: true,
    speedKmh: 0,
    frontWheelWorldY: 0,
    rearWheelWorldY: 0,
  };

  private hopCharge = 0;
  private pedalVelocity = 0;
  private lastPumpTime = 0;
  private currentOrientation = new THREE.Quaternion();
  private camPos = new THREE.Vector3();
  private camLookAt = new THREE.Vector3();
  private camUp = new THREE.Vector3(0, 1, 0);

  private frontWheel: WheelRayState = this.createWheelState();
  private rearWheel: WheelRayState = this.createWheelState();

  private readonly wheelRadius = 0.37;
  private readonly wheelBaseLength = 0.86;
  private readonly wheelTrackWidth = 0.18;
  private readonly frontWheelCastOffset = 0.86;
  private readonly rearWheelCastOffset = -0.58;

  constructor() {
    this.reset();
  }

  public toggleDebugOverlay() {
    this.debugOverlayEnabled = !this.debugOverlayEnabled;
  }

  public getDebugInfo() {
    return {
      ...this.debugInfo,
      frontCompression: Number(this.frontSuspensionCompression.toFixed(3)),
      rearCompression: Number(this.rearSuspensionCompression.toFixed(3)),
      speedKmh: Number((this.speed * 3.6).toFixed(1)),
      surface: this.currentSurface,
      isGrounded: this.isGrounded,
    };
  }

  private createWheelState(): WheelRayState {
    return {
      restLength: 0.38,
      travel: 0.18,
      radius: 0.37,
      compression: 0.18,
      compressionVelocity: 0,
      springRate: 11000,
      dampingRate: 2200,
      reboundRate: 1400,
      bottomOutForce: 30000,
      stiction: 120,
      contactPoint: new THREE.Vector3(),
      contactNormal: new THREE.Vector3(0, 1, 0),
      groundHeight: 0,
      surface: 'dirt',
      worldPos: new THREE.Vector3(),
      worldVel: new THREE.Vector3(),
      force: 0,
      penetration: 0,
    };
  }

  private getTrackSample(trail: GeneratedTrail, worldX: number, worldZ: number) {
    if (trail.getTrackSurfacePoint) {
      const sample = trail.getTrackSurfacePoint(this.trackDistance, this.lateralOffset);
      if (sample) {
        return {
          position: sample.position.clone(),
          normal: sample.normal.clone().normalize(),
          surface: (sample as any).surface ?? 'dirt',
          point: trail.getPointAtDistance(this.trackDistance),
        };
      }
    }

    const y = trail.getTerrainHeight(worldX, worldZ);
    const e = 0.4;
    const hL = trail.getTerrainHeight(worldX - e, worldZ);
    const hR = trail.getTerrainHeight(worldX + e, worldZ);
    const hD = trail.getTerrainHeight(worldX, worldZ - e);
    const hU = trail.getTerrainHeight(worldX, worldZ + e);
    const normal = new THREE.Vector3(-(hR - hL) / (2 * e), 1, -(hU - hD) / (2 * e)).normalize();

    return {
      position: new THREE.Vector3(worldX, y, worldZ),
      normal,
      surface: 'grass' as SurfaceType,
      point: trail.getPointAtDistance(this.trackDistance),
    };
  }

  private applySmallBumpCompliance(targetCompression: number, wheel: WheelRayState) {
    // Small bumps should feel soft and compliant before the wheel reaches the mid-stroke.
    // This prevents harsh jitter from tiny terrain chatter while preserving firm support under heavier loads.
    const smallBumpInfluence = 1.0 - Math.min(1, wheel.compression * 1.8);
    const smallBumpScale = 0.45 + smallBumpInfluence * 0.55;
    return targetCompression * smallBumpScale;
  }

  private updateWheelRaycast(
    wheel: WheelRayState,
    trail: GeneratedTrail,
    worldPos: THREE.Vector3,
    dt: number
  ) {
    const sample = this.getTrackSample(trail, worldPos.x, worldPos.z);
    const groundY = sample.position.y;
    const rayOriginY = worldPos.y + 0.35;
    const suspensionDistance = Math.max(0.05, rayOriginY - groundY);

    const targetCompression = THREE.MathUtils.clamp(
      (wheel.restLength - suspensionDistance) / wheel.travel,
      0,
      1
    );

    const softenedTarget = this.applySmallBumpCompliance(targetCompression, wheel);
    const prevCompression = wheel.compression;
    const compressionDelta = softenedTarget - prevCompression;
    wheel.compressionVelocity = compressionDelta / Math.max(dt, 1 / 240);

    const stiffnessBlend = 1 - Math.exp(-dt * 20);
    const complianceFactor = 0.72 + (1.0 - Math.min(1, wheel.compression * 1.4)) * 0.4;
    wheel.compression += (softenedTarget - wheel.compression) * stiffnessBlend * complianceFactor;

    const progressiveRate = 1.0 + 2.5 * Math.pow(wheel.compression, 2.0);
    const springForce = wheel.springRate * progressiveRate * wheel.compression * 0.35;
    const damperForce = -wheel.dampingRate * wheel.compressionVelocity;
    const reboundForce = -wheel.reboundRate * Math.max(0, -wheel.compressionVelocity);
    const stictionForce = wheel.stiction * Math.sign(wheel.compressionVelocity || 1) * Math.min(1, Math.abs(wheel.compressionVelocity) * 0.8);
    const bottomOutForce = wheel.compression > 0.88
      ? wheel.bottomOutForce * (wheel.compression - 0.88) * 5
      : 0;

    wheel.force = springForce + damperForce + reboundForce + stictionForce + bottomOutForce;
    wheel.contactPoint.copy(sample.position);
    wheel.contactNormal.copy(sample.normal).normalize();
    wheel.groundHeight = groundY;
    wheel.surface = sample.surface as SurfaceType;
    wheel.worldPos.copy(worldPos);
    wheel.penetration = Math.max(0, rayOriginY - sample.position.y);
  }

  private setWheelStatesFromTrack(trail: GeneratedTrail, dt: number) {
    const point = trail.getPointAtDistance(this.trackDistance);
    const tangent = point.tangent.clone().normalize();
    const binormal = point.binormal.clone().normalize();
    const up = point.normal.clone().normalize();

    const bikeCenter = point.position.clone().addScaledVector(binormal, this.lateralOffset);

    const frontWorld = bikeCenter
      .clone()
      .addScaledVector(tangent, this.frontWheelCastOffset)
      .addScaledVector(binormal, this.wheelTrackWidth);

    const rearWorld = bikeCenter
      .clone()
      .addScaledVector(tangent, this.rearWheelCastOffset)
      .addScaledVector(binormal, -this.wheelTrackWidth);

    const frontWorldDown = frontWorld.clone().addScaledVector(up, 1.0);
    const rearWorldDown = rearWorld.clone().addScaledVector(up, 1.0);

    this.updateWheelRaycast(this.frontWheel, trail, frontWorldDown, dt);
    this.updateWheelRaycast(this.rearWheel, trail, rearWorldDown, dt);

    this.frontSuspensionCompression = THREE.MathUtils.clamp(this.frontWheel.compression, 0, 1);
    this.rearSuspensionCompression = THREE.MathUtils.clamp(this.rearWheel.compression, 0, 1);

    const avgGround = (this.frontWheel.groundHeight + this.rearWheel.groundHeight) * 0.5;
    this.verticalOffset = Math.max(0, avgGround - this.worldAltitude);

    this.debugInfo = {
      frontCompression: this.frontSuspensionCompression,
      rearCompression: this.rearSuspensionCompression,
      frontPenetration: this.frontWheel.penetration,
      rearPenetration: this.rearWheel.penetration,
      surface: this.currentSurface,
      isGrounded: this.isGrounded,
      speedKmh: this.speed * 3.6,
      frontWheelWorldY: this.frontWheel.worldPos.y,
      rearWheelWorldY: this.rearWheel.worldPos.y,
    };
  }

  reset(trail?: GeneratedTrail) {
    this.trackDistance = 0; this.lateralOffset = 0; this.verticalOffset = 0;
    this.verticalVelocity = 0; this.speed = 0; this.steerAngle = 0;
    this.leanAngle = 0; this.pitchAngle = 0; this.airWhipAngle = 0;
    this.wheelRotation = 0; this.pedalAngle = 0; this.currentGear = 4;
    this.brakePressure = 0; this.frontBrakePressure = 0; this.driftFactor = 0;
    this.lateralGForce = 0; this.currentSurface = 'dirt'; this.pumpReady = false;
    this.isGrounded = true; this.isSkidding = false; this.isCrashed = false;
    this.crashTimer = 0; this.airTime = 0; this.currentScore = 0;
    this.stuntName = ''; this.jumpsCompleted = 0; this.lastCheckpointPassed = -1;
    this.elapsedTime = 0; this.hopCharge = 0; this.pedalVelocity = 0;
    this.lastPumpTime = 0; this.raceStartTime = performance.now();
    this.isOffTrack = false; this.offTrackTimer = 0;
    this.isRespawning = false; this.respawnTimer = 0; this.invulnerableTimer = 0;
    this.isFinished = false; this.currentCameraRoll = 0;
    this.worldAltitude = 0; this.worldVerticalVelocity = 0;
    this.frontSuspensionCompression = 0.25;
    this.rearSuspensionCompression = 0.28;
    this.activeSplitDelta = null;
    this.splitDeltaTimer = 0;
    this.activeApproachingGate = null;
    this.passedGateCues.clear();

    this.frontWheel = this.createWheelState();
    this.rearWheel = this.createWheelState();

    if (!trail) {
      this.currentOrientation.identity();
      return;
    }

    const point = trail.getPointAtDistance(0);
    const right = point.binormal.clone().normalize();
    const up = point.normal.clone().normalize();
    const basis = new THREE.Matrix4().makeBasis(right, up, point.tangent.clone().negate());
    this.currentOrientation.setFromRotationMatrix(basis);
    const start = point.position.clone().addScaledVector(up, 0.37);
    this.worldAltitude = point.position.y;
    this.camPos.copy(start).add(new THREE.Vector3(0, 1.22, 0.05).applyQuaternion(this.currentOrientation));
    this.camLookAt.copy(start).add(new THREE.Vector3(0, 0.82, -14.0).applyQuaternion(this.currentOrientation));
  }

  private getContact(trail: GeneratedTrail) {
    const point = trail.getPointAtDistance(this.trackDistance);
    const position = point.position.clone().addScaledVector(point.binormal, this.lateralOffset);
    const insideRibbon = Math.abs(this.lateralOffset) <= point.width;

    if (insideRibbon && trail.getTrackSurfacePoint) {
      const surface = trail.getTrackSurfacePoint(this.trackDistance, this.lateralOffset);
      return { position: surface.position, normal: surface.normal, point, insideRibbon: true };
    }

    const height = trail.getTerrainHeight(position.x, position.z);
    const e = 0.45;
    const left = trail.getTerrainHeight(position.x - e, position.z);
    const right = trail.getTerrainHeight(position.x + e, position.z);
    const down = trail.getTerrainHeight(position.x, position.z - e);
    const up = trail.getTerrainHeight(position.x, position.z + e);
    const normal = new THREE.Vector3(-(right - left) / (2 * e), 1, -(up - down) / (2 * e)).normalize();
    position.y = height;
    return { position, normal, point, insideRibbon: false };
  }

  update(delta: number, controls: PlayerControls, bike: BikeCustomization, trail: GeneratedTrail) {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    this.elapsedTime += dt;

    if (this.splitDeltaTimer > 0) {
      this.splitDeltaTimer -= dt;
      if (this.splitDeltaTimer <= 0) {
        this.activeSplitDelta = null;
      }
    }

    if (this.isCrashed) {
      this.crashTimer += dt;
      this.speed = 0;
      this.leanAngle = THREE.MathUtils.lerp(this.leanAngle, 1.25, dt * 5);
      this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, 0.35, dt * 4);
      if (this.crashTimer >= 1.5) {
        this.isCrashed = false;
        this.crashTimer = 0;
        this.lateralOffset = 0;
        this.verticalOffset = 0;
        this.worldVerticalVelocity = 0;
        this.leanAngle = 0;
        this.pitchAngle = 0;
        this.steerAngle = 0;
        this.driftFactor = 0;
        this.isGrounded = true;
        this.speed = 15 / 3.6;
        soundEngine.playCheckpoint();
      }
      return;
    }

    const contact = this.getContact(trail);
    const point = contact.point;
    const insideRibbon = contact.insideRibbon;
    this.currentSurface = insideRibbon ? (point.surface || 'dirt') : 'grass';

    this.setWheelStatesFromTrack(trail, dt);

    const gradeRad = point.grade * Math.PI / 180;
    const slope = Math.sin(gradeRad);
    const grip = point.surface === 'rock'
      ? 0.58
      : point.surface === 'loose_gravel'
        ? 0.72
        : 0.92;

    const prevBraking = this.brakePressure + this.frontBrakePressure;
    this.brakePressure = controls.brake ? Math.min(1, this.brakePressure + dt * 5) : Math.max(0, this.brakePressure - dt * 7);
    this.frontBrakePressure = controls.frontBrake ? Math.min(1, this.frontBrakePressure + dt * 5) : Math.max(0, this.frontBrakePressure - dt * 7);
    const braking = (this.brakePressure * 5 + this.frontBrakePressure * 8) * (0.7 + bike.brakes.power * 0.3);

    if ((controls.brake || controls.frontBrake) && prevBraking < 0.15 && this.speed > 3) {
      soundEngine.playBrakeRotorHiss(Math.max(this.brakePressure, this.frontBrakePressure), this.currentSurface);
    }

    const speedKmh = this.speed * 3.6;
    const speedAuthority = speedKmh > 50
      ? 1.0 + Math.min(0.75, (speedKmh - 50) / 30 * 0.65)
      : 1.0;

    let targetSteer = ((controls.steerRight ? 1 : 0) - (controls.steerLeft ? 1 : 0)) * 0.5 * speedAuthority;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * 10);
    const turnRate = this.steerAngle * (this.speed * 0.85 + 2.4);
    this.lateralGForce = Math.abs(turnRate) / 9.81;
    this.driftFactor = Math.min(1, Math.max(0, this.driftFactor + (this.lateralGForce > grip * 0.8 ? dt * 2 : -dt * 3)));
    this.isSkidding = this.brakePressure > 0.62 || this.driftFactor > 0.35;

    const lookAheadDist = Math.min(trail.totalLength, this.trackDistance + Math.max(1.2, this.speed * dt * 2.0));
    const nextPoint = trail.getPointAtDistance(lookAheadDist);
    const splineDistDelta = Math.max(0.1, lookAheadDist - this.trackDistance);
    const tangentDelta = nextPoint.tangent.clone().sub(point.tangent);
    const trackCurvature = tangentDelta.dot(point.binormal) / splineDistDelta;
    const centrifugalDrift = -trackCurvature * Math.min(18.0, this.speed * 0.95);

    const manualSteerRate = this.steerAngle * (this.speed * 1.05 + 2.4) * (1 + this.driftFactor * 0.5);
    this.lateralOffset += (manualSteerRate + centrifugalDrift) * dt;

    const slopeAngleCos = contact.normal.y;
    if (slopeAngleCos < 0.6428 && this.isGrounded && this.isOffTrack) {
      const steepnessFactor = (0.6428 - slopeAngleCos) / 0.6428;
      this.speed = Math.max(0, this.speed - (14.0 * steepnessFactor + 8.0) * dt);
      const corridorPull = -Math.sign(this.lateralOffset);
      this.lateralOffset += corridorPull * (7.0 * steepnessFactor + 3.5) * dt;
    }

    trail.checkpoints.forEach((checkpoint, index) => {
      if (Math.abs(this.trackDistance - checkpoint) < 4.0 && this.lastCheckpointPassed < index) {
        this.lastCheckpointPassed = index;
        this.isOffTrack = false;
        this.offTrackTimer = 0;
        soundEngine.playCheckpoint();
        soundEngine.playAirHorn();

        const expectedPaceSeconds = (checkpoint / Math.max(1, trail.totalLength)) * 78.0;
        const delta = this.elapsedTime - expectedPaceSeconds;
        this.activeSplitDelta = {
          splitIndex: index + 1,
          deltaSeconds: Number(delta.toFixed(2)),
          isAhead: delta <= 0,
        };
        this.splitDeltaTimer = 3.5;

        if (index === trail.checkpoints.length - 1) {
          this.isFinished = true;
        }
      }
    });

    this.activeApproachingGate = null;
    for (let i = 0; i < trail.checkpoints.length; i++) {
      const cpDist = trail.checkpoints[i];
      if (this.trackDistance < cpDist && this.trackDistance >= cpDist - 36.0) {
        const distToGate = cpDist - this.trackDistance;
        const gateSp = trail.getPointAtDistance(cpDist);
        const gateHalfWidth = Math.max(5.6, gateSp.width * 1.25);
        const isFinish = i === trail.checkpoints.length - 1;
        const isAligned = Math.abs(this.lateralOffset) < gateHalfWidth - 0.75;

        this.activeApproachingGate = {
          gateNumber: i + 1,
          distanceToGate: Math.round(distToGate),
          lateralOffset: this.lateralOffset,
          gateHalfWidth,
          isAligned,
          isFinish,
        };

        if (!this.passedGateCues.has(i)) {
          this.passedGateCues.add(i);
          soundEngine.playSplitApproachCue();
        }
        break;
      }
    }

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }

    const isNearGate = trail.checkpoints.some((cp) => Math.abs(this.trackDistance - cp) < 25.0);
    const maxBound = isNearGate ? 12.0 : 6.8;
    if (Math.abs(this.lateralOffset) > maxBound && this.invulnerableTimer <= 0) {
      this.isOffTrack = true;
      this.offTrackTimer += dt;
      if (this.offTrackTimer >= 1.5 || Math.abs(this.lateralOffset) > 18.0) {
        this.triggerRespawn(trail);
      }
    } else {
      this.isOffTrack = false;
      this.offTrackTimer = Math.max(0, this.offTrackTimer - dt * 2.0);
    }

    if (this.isRespawning) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.isRespawning = false;
      }
    }

    if (point.surface === 'wood' || point.type === 'wood_bridge') {
      const bridgeHalfWidth = point.width * 0.5 + 0.45;
      if (Math.abs(this.lateralOffset) > bridgeHalfWidth) {
        const railSide = Math.sign(this.lateralOffset);
        this.lateralOffset = railSide * bridgeHalfWidth;
        this.speed = Math.max(0, this.speed - 2.2);
        soundEngine.playLandingThump(1.8);
      }
    }

    if (trail.obstacles && trail.obstacles.length > 0 && this.invulnerableTimer <= 0) {
      for (const obs of trail.obstacles) {
        const distDiff = Math.abs(this.trackDistance - obs.distance);
        if (distDiff < 1.8) {
          const latDiff = Math.abs(this.lateralOffset - obs.lateralOffset);
          const hitRadius = obs.radius + 0.35;
          if (latDiff < hitRadius) {
            if (this.verticalOffset < obs.height + 0.08) {
              if (obs.type === 'stake') {
                const deflect = this.lateralOffset >= obs.lateralOffset ? 1 : -1;
                this.lateralOffset += deflect * 0.55;
                this.speed = Math.max(3.8, this.speed - 3.4);
                this.frontSuspensionCompression = Math.min(1.0, this.frontSuspensionCompression + 0.45);
                soundEngine.playLandingThump(3.0);
              } else if (obs.type === 'stump' || this.speed * 3.6 > 30.0) {
                const crashLabel = obs.type === 'stump'
                  ? 'TREE STRIKE WIPEOUT!'
                  : 'ROCK STRIKE WIPEOUT!';
                this.triggerCrash(crashLabel);
                return;
              } else {
                this.frontSuspensionCompression = Math.min(1.0, this.frontSuspensionCompression + 0.55);
                this.rearSuspensionCompression = Math.min(1.0, this.rearSuspensionCompression + 0.45);
                soundEngine.playLandingThump(3.8);
                const deflect = this.lateralOffset >= obs.lateralOffset ? 1 : -1;
                this.lateralOffset += deflect * 0.4;
                this.speed = Math.max(0, this.speed - 4.0);
              }
            }
          }
        }
      }
    }

    if (this.isFinished) {
      controls.pedal = false;
      controls.bunnyHop = false;
      controls.pump = false;
      controls.tuck = false;
      controls.steerLeft = false;
      controls.steerRight = false;
    }

    let propulsion = controls.pedal ? 4.8 * (1 - Math.min(1, this.speed / 18)) : 0;
    if (controls.pump && this.isGrounded && performance.now() - this.lastPumpTime > 650) {
      this.lastPumpTime = performance.now(); propulsion += 2.2; this.pumpReady = true;
      this.currentScore += 50; soundEngine.playPumpSurge();
    } else this.pumpReady = this.isGrounded && slope > 0.04 && this.speed > 4;

    const dragCoefficient = controls.tuck ? 0.0044 : 0.0058;
    const aeroDrag = this.speed * this.speed * dragCoefficient;

    const isOffTrackGrass = !insideRibbon || this.currentSurface === 'grass' || Math.abs(this.lateralOffset) > point.width;
    if (isOffTrackGrass) {
      if (this.speed > 30 / 3.6) {
        this.speed *= 0.94;
      }
      if (Math.abs(this.steerAngle) > 0.04) {
        this.driftFactor = Math.min(1.0, this.driftFactor + Math.abs(this.steerAngle) * 4.0 * dt);
        this.lateralOffset += Math.sign(this.steerAngle) * this.speed * 0.45 * dt;
        this.isSkidding = true;
      }
    }

    const grassResistance = isOffTrackGrass ? (14.0 + this.speed * 0.5) : 0;
    const rolling = (0.18 + this.speed * 0.012) + grassResistance;
    const lateralScrub = this.driftFactor * (this.brakePressure > 0.35 ? 1.5 : 0.45);
    const finishBraking = this.isFinished ? 8.5 : 0;

    this.speed = Math.max(0, this.speed + (9.81 * slope + propulsion - aeroDrag - rolling - braking - finishBraking - lateralScrub) * dt);
    if (this.speed < 0.5 && !controls.pedal && this.trackDistance < 1.5) this.speed = 0;
    this.trackDistance = Math.max(0, Math.min(trail.totalLength, this.trackDistance + this.speed * dt));
    this.wheelRotation -= this.speed * dt / 0.36;

    const groundSlopeVelocity = -this.speed * Math.sin(gradeRad);
    const groundY = contact.position.y;

    if (controls.bunnyHop && this.isGrounded) {
      this.hopCharge = Math.min(1, this.hopCharge + dt * 3);
    } else if (!controls.bunnyHop && this.isGrounded && this.hopCharge > 0.15) {
      this.worldVerticalVelocity = groundSlopeVelocity + 3.8 + this.hopCharge * 4.6;
      this.isGrounded = false;
      this.hopCharge = 0; this.jumpsCompleted++; soundEngine.playJumpLaunch();
    } else if (!controls.bunnyHop) {
      this.hopCharge = 0;
    }

    if (!this.isGrounded) {
      this.airTime += dt;
      const gravity = 14.5;
      this.worldVerticalVelocity -= gravity * dt;
      this.worldAltitude += this.worldVerticalVelocity * dt;

      this.lateralOffset += this.steerAngle * (this.speed * 0.28 + 1.0) * dt;

      this.frontSuspensionCompression += (0.02 - this.frontSuspensionCompression) * Math.min(1, dt * 8);
      this.rearSuspensionCompression += (0.03 - this.rearSuspensionCompression) * Math.min(1, dt * 8);

      if (this.worldAltitude <= groundY) {
        const impactSpeed = Math.abs(this.worldVerticalVelocity - groundSlopeVelocity);
        this.worldAltitude = groundY;
        this.worldVerticalVelocity = 0;
        this.verticalOffset = 0;
        this.isGrounded = true;

        soundEngine.playLandingThump(impactSpeed);
        if (this.airTime > 0.6) this.currentScore += Math.round(this.airTime * 250);
        this.airTime = 0;

        const landingForce = Math.min(0.85, impactSpeed * 0.14);
        this.frontSuspensionCompression = Math.min(1.0, this.frontSuspensionCompression + landingForce);
        this.rearSuspensionCompression = Math.min(1.0, this.rearSuspensionCompression + landingForce * 1.1);

        const tangent = point.tangent.clone().normalize();
        const groundNormal = contact.normal.clone().normalize();
        const forwardSlope = tangent.dot(groundNormal);
        this.pitchAngle = forwardSlope * 0.85;
      } else {
        this.verticalOffset = Math.max(0, this.worldAltitude - groundY);
      }
    } else {
      this.worldAltitude = groundY;
      this.worldVerticalVelocity = 0;
      this.verticalOffset = 0;

      const nextDist = Math.min(trail.totalLength, this.trackDistance + 1.8);
      const nextPoint = trail.getPointAtDistance(nextDist);
      const heightDrop = point.position.y - nextPoint.position.y;
      if (heightDrop > 0.65 && this.speed > 11 && (point.type === 'jump' || point.type === 'drop' || heightDrop > 1.1)) {
        this.worldVerticalVelocity = Math.max(groundSlopeVelocity, (this.speed - 10) * 0.22 + 2.5);
        this.isGrounded = false;
        soundEngine.playJumpLaunch();
      }

      const frontTarget = THREE.MathUtils.clamp(this.frontWheel.compression, 0, 1);
      const rearTarget = THREE.MathUtils.clamp(this.rearWheel.compression, 0, 1);

      const forkRate = frontTarget > this.frontSuspensionCompression ? 28 : 14;
      const shockRate = rearTarget > this.rearSuspensionCompression ? 20 : 11;

      this.frontSuspensionCompression = THREE.MathUtils.clamp(
        this.frontSuspensionCompression + (frontTarget - this.frontSuspensionCompression) * Math.min(1, dt * forkRate),
        0.0,
        1.0
      );
      this.rearSuspensionCompression = THREE.MathUtils.clamp(
        this.rearSuspensionCompression + (rearTarget - this.rearSuspensionCompression) * Math.min(1, dt * shockRate),
        0.0,
        1.0
      );

      this.pitchAngle += ((this.frontSuspensionCompression - this.rearSuspensionCompression) * 0.25 - this.pitchAngle) * Math.min(1, dt * 10);
    }

    const speedRatio = Math.min(1.0, Math.max(0.18, this.speed / 18.0));
    const targetLean = THREE.MathUtils.clamp(
      -this.steerAngle * (0.24 + speedRatio * 0.44) - point.bankAngle * 0.65,
      -0.42,
      0.42
    );
    const leanLerp = THREE.MathUtils.clamp(dt * 7.0, 0.08, 0.12);
    this.leanAngle += (targetLean - this.leanAngle) * leanLerp;
    this.pedalAngle += (controls.pedal ? this.speed * 3.8 : 0) * dt;

    trail.checkpoints.forEach((checkpoint, index) => {
      if (this.trackDistance >= checkpoint && this.lastCheckpointPassed < index) {
        this.lastCheckpointPassed = index; soundEngine.playCheckpoint();
      }
    });

    const currentDecel = (this.brakePressure * 5 + this.frontBrakePressure * 8);
    soundEngine.update(
      this.speed * 3.6,
      this.isGrounded,
      controls.pedal,
      controls.brake || !!controls.frontBrake,
      this.isSkidding,
      0,
      this.currentSurface,
      currentDecel
    );
  }

  triggerCrash(reason: string) {
    this.isCrashed = true;
    this.crashTimer = 0;
    this.speed = 0;
    this.stuntName = reason;
    soundEngine.playCrash();
  }

  triggerRespawn(trail: GeneratedTrail) {
    this.isRespawning = true;
    this.respawnTimer = 1.0;
    this.invulnerableTimer = 1.0;
    this.isOffTrack = false;
    this.offTrackTimer = 0;
    this.isCrashed = false;
    this.crashTimer = 0;

    this.speed = 28.0 / 3.6;
    this.lateralOffset = 0;
    this.verticalOffset = 0;
    this.worldVerticalVelocity = 0;
    this.leanAngle = 0;
    this.pitchAngle = 0;
    this.steerAngle = 0;
    this.driftFactor = 0;
    this.isGrounded = true;
    this.airTime = 0;

    let targetDist = 0;
    if (trail.checkpoints && trail.checkpoints.length > 0) {
      let nearestDist = trail.checkpoints[0];
      let minDelta = Math.abs(this.trackDistance - nearestDist);
      for (let i = 1; i < trail.checkpoints.length; i++) {
        const cp = trail.checkpoints[i];
        const delta = Math.abs(this.trackDistance - cp);
        if (delta < minDelta) {
          minDelta = delta;
          nearestDist = cp;
        }
      }
      targetDist = this.trackDistance < 35 ? 0 : nearestDist;
    }
    this.trackDistance = targetDist;

    const point = trail.getPointAtDistance(this.trackDistance);
    this.worldAltitude = point.position.y;
    const tangent = point.tangent.clone().normalize();
    const up = point.normal.clone().normalize();
    const right = point.binormal.clone().normalize();
    const basis = new THREE.Matrix4().makeBasis(right, up, tangent.clone().negate());
    this.currentOrientation.setFromRotationMatrix(basis);

    const start = point.position.clone().addScaledVector(up, 0.37);
    this.camPos.copy(start).add(new THREE.Vector3(0, 1.22, 0.05).applyQuaternion(this.currentOrientation));
    this.camLookAt.copy(start).add(new THREE.Vector3(0, 0.82, -14.0).applyQuaternion(this.currentOrientation));
    this.camUp.copy(up);

    soundEngine.playCheckpoint();
  }

  updateBikeAndCamera(bikeGroup: THREE.Group, trail: GeneratedTrail, camera: THREE.Camera, cameraView: CameraView, dt = 0.016) {
    const contact = this.getContact(trail);
    const point = contact.point;
    const sagOffset = Math.max(0.24, 0.37 - (this.frontSuspensionCompression + this.rearSuspensionCompression) * 0.1);
    const groundPos = contact.position.clone();
    if (!this.isGrounded) {
      groundPos.y = this.worldAltitude;
    }
    groundPos.addScaledVector(contact.normal, sagOffset);
    bikeGroup.position.copy(groundPos);

    const tangent = point.tangent.clone().normalize();
    const up = contact.normal.clone().normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const correctedUp = new THREE.Vector3().crossVectors(right, tangent).normalize();
    const base = new THREE.Matrix4().makeBasis(right, correctedUp, tangent.clone().negate());
    const target = new THREE.Quaternion().setFromRotationMatrix(base);

    const steerYaw = -this.steerAngle * 0.22;
    target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), steerYaw));
    target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitchAngle));
    target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.leanAngle));
    if (!this.isGrounded) target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.airWhipAngle));
    const smoothBob = 1 - Math.exp(-dt * 12.0);
    this.currentOrientation.slerp(target, smoothBob);
    bikeGroup.quaternion.copy(this.currentOrientation);

    const bikeQuat = bikeGroup.quaternion;
    const cameraResponse = 1 - Math.exp(-dt * (cameraView === 'chase_cam' ? 12 : 18));

    if (cameraView === 'first_person_helmet') {
      const eyeOffset = new THREE.Vector3(0, 1.14, 0.12).applyQuaternion(bikeQuat);
      const targetCamPos = groundPos.clone().add(eyeOffset);
      this.camPos.lerp(targetCamPos, cameraResponse);

      const lookOffset = new THREE.Vector3(0, 0.60, -12.0).applyQuaternion(bikeQuat);
      const targetLookAt = groundPos.clone().add(lookOffset);
      this.camLookAt.lerp(targetLookAt, 1 - Math.exp(-dt * 16));

      const bikeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(bikeQuat);
      const stabilizedUp = new THREE.Vector3(0, 1, 0).lerp(bikeUp, 0.38).normalize();
      this.camUp.lerp(stabilizedUp, 1 - Math.exp(-dt * 8));
    } else if (cameraView === 'first_person_stem') {
      const targetCamPos = groundPos.clone().add(new THREE.Vector3(0, 0.98, -0.22).applyQuaternion(bikeQuat));
      const targetLookAt = groundPos.clone().add(new THREE.Vector3(0, 0.8, -14).applyQuaternion(bikeQuat));
      this.camPos.lerp(targetCamPos, cameraResponse);
      this.camLookAt.lerp(targetLookAt, 1 - Math.exp(-dt * 15));

      const bikeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(bikeQuat);
      const stabilizedUp = new THREE.Vector3(0, 1, 0).lerp(bikeUp, 0.42).normalize();
      this.camUp.lerp(stabilizedUp, 1 - Math.exp(-dt * 8));
    } else {
      const focusPos = groundPos.clone().add(new THREE.Vector3(0, 1.05, 0));
      const idealOffset = new THREE.Vector3(0.28, 1.48, 3.2).applyQuaternion(bikeQuat);
      const targetCamPos = groundPos.clone().add(idealOffset);

      const bikeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(bikeQuat);
      const stabilizedUp = new THREE.Vector3(0, 1, 0).lerp(bikeUp, 0.32).normalize();
      this.camUp.lerp(stabilizedUp, 1 - Math.exp(-dt * 7));

      const numSamples = 5;
      for (let s = 1; s <= numSamples; s++) {
        const t = s / numSamples;
        const testPos = new THREE.Vector3().lerpVectors(focusPos, targetCamPos, t);
        const terrainH = trail.getTerrainHeight(testPos.x, testPos.z) + 0.55;
        if (testPos.y < terrainH) {
          const penetration = terrainH - testPos.y;
          targetCamPos.y = Math.max(targetCamPos.y, terrainH + 0.35);
          targetCamPos.lerp(focusPos, Math.min(0.45, penetration * 0.18));
        }
      }

      const camGroundH = trail.getTerrainHeight(targetCamPos.x, targetCamPos.z) + 0.65;
      if (targetCamPos.y < camGroundH) {
        targetCamPos.y = camGroundH;
      }

      this.camPos.lerp(targetCamPos, 1 - Math.exp(-dt * 9));
      this.camLookAt.lerp(groundPos.clone().add(new THREE.Vector3(0.06, 0.72, -4.2).applyQuaternion(bikeQuat)), 1 - Math.exp(-dt * 10));
    }

    const safeFloorY = trail.getTerrainHeight(this.camPos.x, this.camPos.z) + 0.45;
    if (this.camPos.y < safeFloorY) {
      this.camPos.y = safeFloorY;
    }

    if (this.isCrashed) {
      const shakeMag = Math.max(0, (1.5 - this.crashTimer) / 1.5) * 0.42;
      this.camPos.x += (Math.random() - 0.5) * shakeMag;
      this.camPos.y += (Math.random() - 0.5) * shakeMag;
      this.camPos.z += (Math.random() - 0.5) * shakeMag;
      if (this.camPos.y < safeFloorY) {
        this.camPos.y = safeFloorY;
      }
    } else if (this.isGrounded && this.speed > 8.0) {
      const rumbleIntensity = Math.min(0.018, (this.speed / 26.0) * (point.surface === 'rock' ? 0.022 : 0.012));
      this.camPos.x += (Math.random() - 0.5) * rumbleIntensity * 0.5;
      this.camPos.y += (Math.random() - 0.5) * rumbleIntensity * 0.5;
    }

    const speedRatio = Math.min(1.0, this.speed / 18.0);
    const targetCameraRoll = -this.steerAngle * (0.16 + speedRatio * 0.20);
    this.currentCameraRoll = THREE.MathUtils.lerp(
      this.currentCameraRoll,
      targetCameraRoll,
      THREE.MathUtils.clamp(dt * 4.5, 0.04, 0.1)
    );

    if (cameraView !== 'chase_cam') {
      camera.position.copy(this.camPos);
      camera.up.copy(this.camUp);
      camera.lookAt(this.camLookAt);
      camera.rotation.z += this.currentCameraRoll;
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      const baseFov = cameraView === 'first_person_helmet' ? 82 : cameraView === 'first_person_stem' ? 76 : 70;
      const speedKmh = this.speed * 3.6;
      const speedWarp = Math.min(15, Math.max(0, (speedKmh - 50) / 40 * 15));
      const targetFov = baseFov + speedWarp;
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-dt * 6));
      camera.updateProjectionMatrix();
    }
  }

  getTelemetry(trail: GeneratedTrail): TelemetryData {
    const point = trail.getPointAtDistance(this.trackDistance);
    const clampedFork = THREE.MathUtils.clamp(Number(this.frontSuspensionCompression.toFixed(3)), 0, 1.0);
    const clampedShock = THREE.MathUtils.clamp(Number(this.rearSuspensionCompression.toFixed(3)), 0, 1.0);
    return {
      speedKmh: this.speed * 3.6,
      speedMph: this.speed * 2.237,
      rpm: Math.round(this.speed * 18),
      gear: this.currentGear,
      maxGear: this.maxGear,
      cadence: Math.round(this.speed * 4.2),
      elevation: Math.round(point.position.y),
      elevationDrop: Math.round(trail.getPointAtDistance(0).position.y - point.position.y),
      gradePercentage: Math.round(Math.tan(point.grade * Math.PI / 180) * 100),
      frontForkTravelPercent: clampedFork,
      rearShockTravelPercent: clampedShock,
      gForce: Number(Math.sqrt(1 + this.lateralGForce ** 2).toFixed(1)),
      leanAngleDeg: Math.round(this.leanAngle * 180 / Math.PI),
      isGrounded: this.isGrounded,
      airTimeSeconds: Number(this.airTime.toFixed(2)),
      jumpCount: this.jumpsCompleted,
      distanceCoveredMeters: Math.round(this.trackDistance),
      totalDistanceMeters: Math.round(trail.totalLength),
      progressPercent: Math.min(100, Math.round(this.trackDistance / trail.totalLength * 100)),
      elapsedTime: Number(this.elapsedTime.toFixed(2)),
      currentCheckPoint: Math.max(0, this.lastCheckpointPassed),
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
      isOffTrack: this.isOffTrack,
      offTrackSeconds: Number(this.offTrackTimer.toFixed(1)),
      isRespawning: this.isRespawning,
      splitDelta: this.activeSplitDelta,
      approachingGate: this.activeApproachingGate,
    };
  }
}















