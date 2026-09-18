import * as THREE from 'three';
import { BikeCustomization, TelemetryData, CameraView } from '../types/game';
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

/** Lightweight downhill physics with terrain-aware wheel contact. */
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

  private hopCharge = 0;
  private pedalVelocity = 0;
  private lastPumpTime = 0;
  private currentOrientation = new THREE.Quaternion();
  private camPos = new THREE.Vector3();
  private camLookAt = new THREE.Vector3();
  private camUp = new THREE.Vector3(0, 1, 0);

  constructor() { this.reset(); }

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

    if (!trail) { this.currentOrientation.identity(); return; }
    const point = trail.getPointAtDistance(0);
    const right = point.binormal.clone().normalize();
    const up = point.normal.clone().normalize();
    const basis = new THREE.Matrix4().makeBasis(right, up, point.tangent.clone().negate());
    this.currentOrientation.setFromRotationMatrix(basis);
    const start = point.position.clone().addScaledVector(up, 0.37);
    this.camPos.copy(start).add(new THREE.Vector3(0, 1.08, 0.28).applyQuaternion(this.currentOrientation));
    this.camLookAt.copy(trail.getPointAtDistance(18).position).add(new THREE.Vector3(0, 0.88, 0));
  }

  /** Contact point and normal for the bike's actual world position. */
  private getContact(trail: GeneratedTrail) {
    const point = trail.getPointAtDistance(this.trackDistance);
    const position = point.position.clone().addScaledVector(point.binormal, this.lateralOffset);
    const insideRibbon = Math.abs(this.lateralOffset) <= point.width * 1.35;

    if (insideRibbon && trail.getTrackSurfacePoint) {
      const surface = trail.getTrackSurfacePoint(this.trackDistance, this.lateralOffset);
      return { position: surface.position, normal: surface.normal, point };
    }

    // Outside the ribbon, use the generated terrain height instead of extrapolating
    // the trail cross-section. This prevents floating, sinking and false edge hits.
    const height = trail.getTerrainHeight(position.x, position.z);
    const e = 0.45;
    const left = trail.getTerrainHeight(position.x - e, position.z);
    const right = trail.getTerrainHeight(position.x + e, position.z);
    const down = trail.getTerrainHeight(position.x, position.z - e);
    const up = trail.getTerrainHeight(position.x, position.z + e);
    const normal = new THREE.Vector3(-(right - left) / (2 * e), 1, -(up - down) / (2 * e)).normalize();
    position.y = height;
    return { position, normal, point };
  }

  update(delta: number, controls: PlayerControls, bike: BikeCustomization, trail: GeneratedTrail) {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    this.elapsedTime += dt;
    if (this.isCrashed) {
      this.crashTimer += dt;
      this.speed = Math.max(0, this.speed - 15 * dt);
      if (this.crashTimer > 1.4) { this.isCrashed = false; this.crashTimer = 0; }
      return;
    }

    const contact = this.getContact(trail);
    const point = contact.point;
    this.currentSurface = point.surface || 'dirt';
    const gradeRad = point.grade * Math.PI / 180;
    const slope = Math.sin(gradeRad);
    const grip = point.surface === 'rock' ? 0.58 : point.surface === 'loose_gravel' ? 0.72 : 0.92;

    this.brakePressure = controls.brake ? Math.min(1, this.brakePressure + dt * 5) : Math.max(0, this.brakePressure - dt * 7);
    this.frontBrakePressure = controls.frontBrake ? Math.min(1, this.frontBrakePressure + dt * 5) : Math.max(0, this.frontBrakePressure - dt * 7);
    const braking = (this.brakePressure * 5 + this.frontBrakePressure * 8) * (0.7 + bike.brakes.power * 0.3);

    let targetSteer = (controls.steerRight ? 1 : 0) - (controls.steerLeft ? 1 : 0);
    targetSteer *= 0.5;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * 9);
    const turnRate = this.steerAngle * (this.speed * 0.8 + 2);
    this.lateralGForce = Math.abs(turnRate) / 9.81;
    this.driftFactor = Math.min(1, Math.max(0, this.driftFactor + (this.lateralGForce > grip * 0.8 ? dt * 2 : -dt * 3)));
    this.isSkidding = this.brakePressure > 0.62 || this.driftFactor > 0.35;

    // Deliberately no trail-edge clamp or edge crash: the terrain is driveable.
    this.lateralOffset += this.steerAngle * (this.speed * 0.9 + 2) * (1 + this.driftFactor * 0.6) * dt;

    let propulsion = controls.pedal ? 4.8 * (1 - Math.min(1, this.speed / 18)) : 0;
    if (controls.pump && this.isGrounded && performance.now() - this.lastPumpTime > 650) {
      this.lastPumpTime = performance.now(); propulsion += 2.2; this.pumpReady = true;
      this.currentScore += 50; soundEngine.playPumpSurge();
    } else this.pumpReady = this.isGrounded && slope > 0.04 && this.speed > 4;

    const drag = (controls.tuck ? 0.0018 : 0.0032) * this.speed * this.speed;
    const rolling = 0.18 + this.speed * 0.012;
    this.speed = Math.max(0, this.speed + (9.81 * slope + propulsion - drag - rolling - braking - this.driftFactor * 2.8) * dt);
    if (this.speed < 0.5 && !controls.pedal && this.trackDistance < 1.5) this.speed = 0;
    this.trackDistance = Math.max(0, Math.min(trail.totalLength, this.trackDistance + this.speed * dt));
    this.wheelRotation -= this.speed * dt / 0.36;

    // Bunny-hop launch.
    if (controls.bunnyHop && this.isGrounded) this.hopCharge = Math.min(1, this.hopCharge + dt * 3);
    else if (!controls.bunnyHop && this.isGrounded && this.hopCharge > 0.15) {
      this.verticalVelocity = 3.6 + this.hopCharge * 4.5; this.isGrounded = false;
      this.hopCharge = 0; this.jumpsCompleted++; soundEngine.playJumpLaunch();
    } else if (!controls.bunnyHop) this.hopCharge = 0;

    if (!this.isGrounded) {
      this.airTime += dt; this.verticalVelocity -= 12.8 * dt; this.verticalOffset += this.verticalVelocity * dt;
      if (this.verticalOffset <= 0) {
        this.verticalOffset = 0; this.verticalVelocity = 0; this.isGrounded = true;
        soundEngine.playLandingThump(Math.abs(this.verticalVelocity));
        if (this.airTime > 0.7) this.currentScore += Math.round(this.airTime * 300);
        this.airTime = 0;
      }
    } else {
      this.verticalOffset = 0; this.verticalVelocity = 0;
      const next = this.getContact(trail);
      const front = trail.getTerrainHeight(next.position.x - next.point.tangent.x * 0.72, next.position.z - next.point.tangent.z * 0.72);
      const rear = trail.getTerrainHeight(next.position.x + next.point.tangent.x * 0.62, next.position.z + next.point.tangent.z * 0.62);
      this.frontSuspensionCompression += (THREE.MathUtils.clamp(0.18 + (next.position.y - front) * 0.08, 0.05, 0.9) - this.frontSuspensionCompression) * Math.min(1, dt * 10);
      this.rearSuspensionCompression += (THREE.MathUtils.clamp(0.22 + (next.position.y - rear) * 0.08, 0.05, 0.9) - this.rearSuspensionCompression) * Math.min(1, dt * 10);
    }

    this.pitchAngle = (this.frontSuspensionCompression - this.rearSuspensionCompression) * 0.3;
    this.leanAngle += (THREE.MathUtils.clamp(-turnRate * 0.025 + point.bankAngle * 0.65, -0.65, 0.65) - this.leanAngle) * Math.min(1, dt * 8);
    this.pedalAngle += (controls.pedal ? this.speed * 3.8 : 0) * dt;

    trail.checkpoints.forEach((checkpoint, index) => {
      if (this.trackDistance >= checkpoint && this.lastCheckpointPassed < index) {
        this.lastCheckpointPassed = index; soundEngine.playCheckpoint();
      }
    });
    soundEngine.update(this.speed * 3.6, this.isGrounded, controls.pedal, controls.brake || !!controls.frontBrake, this.isSkidding, 0);
  }

  triggerCrash(reason: string) { this.isCrashed = true; this.crashTimer = 0; this.stuntName = reason; soundEngine.playCrash(); }

  updateBikeAndCamera(bikeGroup: THREE.Group, trail: GeneratedTrail, camera: THREE.Camera, cameraView: CameraView, dt = 0.016) {
    const contact = this.getContact(trail);
    const point = contact.point;
    const groundPos = contact.position.clone().addScaledVector(contact.normal, this.verticalOffset + Math.max(0.24, 0.37 - (this.frontSuspensionCompression + this.rearSuspensionCompression) * 0.1));
    bikeGroup.position.copy(groundPos);

    const tangent = point.tangent.clone().normalize();
    const up = contact.normal.clone().normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const correctedUp = new THREE.Vector3().crossVectors(right, tangent).normalize();
    const base = new THREE.Matrix4().makeBasis(right, correctedUp, tangent.clone().negate());
    const target = new THREE.Quaternion().setFromRotationMatrix(base);
    target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitchAngle));
    target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.leanAngle));
    if (!this.isGrounded) target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.airWhipAngle));
    this.currentOrientation.slerp(target, 1 - Math.exp(-18 * dt));
    bikeGroup.quaternion.copy(this.currentOrientation);

    const bikeQuat = bikeGroup.quaternion;
    if (cameraView === 'first_person_helmet') {
      this.camPos.lerp(groundPos.clone().add(new THREE.Vector3(0, 1.08, 0.28).applyQuaternion(bikeQuat)), 1 - Math.exp(-22 * dt));
      const look = point.position.clone().addScaledVector(point.binormal, this.lateralOffset * 0.5).add(new THREE.Vector3(0, 0.82, 0));
      this.camLookAt.lerp(look, 1 - Math.exp(-15 * dt)); camera.position.copy(this.camPos); camera.up.copy(this.camUp); camera.lookAt(this.camLookAt);
    } else if (cameraView === 'first_person_stem') {
      this.camPos.lerp(groundPos.clone().add(new THREE.Vector3(0, 0.98, -0.22).applyQuaternion(bikeQuat)), 1 - Math.exp(-24 * dt));
      this.camLookAt.lerp(groundPos.clone().add(new THREE.Vector3(0, 0.8, -14).applyQuaternion(bikeQuat)), 1 - Math.exp(-20 * dt)); camera.position.copy(this.camPos); camera.lookAt(this.camLookAt);
    } else {
      this.camPos.lerp(groundPos.clone().add(new THREE.Vector3(0, 1.6, 3.8).applyQuaternion(bikeQuat)), 1 - Math.exp(-10 * dt));
      this.camLookAt.lerp(groundPos.clone().add(new THREE.Vector3(0, 0.75, -1.8).applyQuaternion(bikeQuat)), 1 - Math.exp(-14 * dt)); camera.position.copy(this.camPos); camera.lookAt(this.camLookAt);
    }
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov += (75 + Math.min(15, this.speed * 3.6 / 70 * 15) - camera.fov) * (1 - Math.exp(-6 * dt)); camera.updateProjectionMatrix();
    }
  }

  getTelemetry(trail: GeneratedTrail): TelemetryData {
    const point = trail.getPointAtDistance(this.trackDistance);
    return {
      speedKmh: this.speed * 3.6, speedMph: this.speed * 2.237, rpm: Math.round(this.speed * 18), gear: this.currentGear, maxGear: this.maxGear,
      cadence: Math.round(this.speed * 4.2), elevation: Math.round(point.position.y), elevationDrop: Math.round(trail.getPointAtDistance(0).position.y - point.position.y),
      gradePercentage: Math.round(Math.tan(point.grade * Math.PI / 180) * 100), frontForkTravelPercent: this.frontSuspensionCompression, rearShockTravelPercent: this.rearSuspensionCompression,
      gForce: Number(Math.sqrt(1 + this.lateralGForce ** 2).toFixed(1)), leanAngleDeg: Math.round(this.leanAngle * 180 / Math.PI), isGrounded: this.isGrounded,
      airTimeSeconds: Number(this.airTime.toFixed(2)), jumpCount: this.jumpsCompleted, distanceCoveredMeters: Math.round(this.trackDistance), totalDistanceMeters: Math.round(trail.totalLength),
      progressPercent: Math.min(100, Math.round(this.trackDistance / trail.totalLength * 100)), elapsedTime: Number(this.elapsedTime.toFixed(2)), currentCheckPoint: Math.max(0, this.lastCheckpointPassed + 1), totalCheckPoints: trail.checkpoints.length,
      crashState: this.isCrashed, score: this.currentScore, streak: Math.min(10, Math.floor(this.currentScore / 500)), stuntName: this.stuntName, surfaceName: this.currentSurface,
      frontBrakePressure: this.frontBrakePressure, rearBrakePressure: this.brakePressure, driftPercent: Math.round(this.driftFactor * 100), pumpReady: this.pumpReady,
    };
  }
}
