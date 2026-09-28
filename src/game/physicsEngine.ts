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

    if (!trail) { this.currentOrientation.identity(); return; }
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

  /** Contact point and normal for the bike's actual world position. */
  private getContact(trail: GeneratedTrail) {
    const point = trail.getPointAtDistance(this.trackDistance);
    const position = point.position.clone().addScaledVector(point.binormal, this.lateralOffset);
    const insideRibbon = Math.abs(this.lateralOffset) <= point.width;

    if (insideRibbon && trail.getTrackSurfacePoint) {
      const surface = trail.getTrackSurfacePoint(this.trackDistance, this.lateralOffset);
      return { position: surface.position, normal: surface.normal, point, insideRibbon: true };
    }

    // Outside the ribbon, use the generated terrain height instead of extrapolating
    // the trail cross-section. This detects off-track grass/wild terrain.
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
      // Brief ragdoll / fall tilt
      this.leanAngle = THREE.MathUtils.lerp(this.leanAngle, 1.25, dt * 5);
      this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, 0.35, dt * 4);
      if (this.crashTimer >= 1.5) {
        // Upright respawn on track centerline!
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
        this.speed = 15 / 3.6; // 15 km/h rolling forward restart
        soundEngine.playCheckpoint();
      }
      return;
    }

    const contact = this.getContact(trail);
    const point = contact.point;
    const insideRibbon = contact.insideRibbon;
    this.currentSurface = insideRibbon ? (point.surface || 'dirt') : 'grass';
    const gradeRad = point.grade * Math.PI / 180;
    const slope = Math.sin(gradeRad);
    const grip = point.surface === 'rock' ? 0.58 : point.surface === 'loose_gravel' ? 0.72 : 0.92;

    const prevBraking = this.brakePressure + this.frontBrakePressure;
    this.brakePressure = controls.brake ? Math.min(1, this.brakePressure + dt * 5) : Math.max(0, this.brakePressure - dt * 7);
    this.frontBrakePressure = controls.frontBrake ? Math.min(1, this.frontBrakePressure + dt * 5) : Math.max(0, this.frontBrakePressure - dt * 7);
    const braking = (this.brakePressure * 5 + this.frontBrakePressure * 8) * (0.7 + bike.brakes.power * 0.3);

    // Audio cue for disc pad bite on initial application
    if ((controls.brake || controls.frontBrake) && prevBraking < 0.15 && this.speed > 3) {
      soundEngine.playBrakeRotorHiss(Math.max(this.brakePressure, this.frontBrakePressure), this.currentSurface);
    }

    // Speed-sensitive steering authority:
    // Dynamically scales steering radius and lateral authority with velocity to prevent extreme understeer at speeds >60 km/h
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

    // 100% Manual Steering with Real Inertial Centrifugal Drift on Turns:
    // When the track curves underneath the bike, inertia naturally carries the bike
    // toward the outside of the turn unless the player manually steers into the corner.
    const lookAheadDist = Math.min(trail.totalLength, this.trackDistance + Math.max(1.2, this.speed * dt * 2.0));
    const nextPoint = trail.getPointAtDistance(lookAheadDist);
    const splineDistDelta = Math.max(0.1, lookAheadDist - this.trackDistance);

    // Curvature in the track plane: dot product of tangent delta with binormal
    const tangentDelta = nextPoint.tangent.clone().sub(point.tangent);
    const trackCurvature = tangentDelta.dot(point.binormal) / splineDistDelta;

    // Centrifugal drift outwards: trackCurvature > 0 means track curves right, so outward drift is left (-binormal)
    const centrifugalDrift = -trackCurvature * Math.min(18.0, this.speed * 0.95);

    // Player direct manual steering (NO artificial berm auto-steer assist):
    const manualSteerRate = this.steerAngle * (this.speed * 1.05 + 2.4) * (1 + this.driftFactor * 0.5);
    this.lateralOffset += (manualSteerRate + centrifugalDrift) * dt;

    // Steep terrain friction (>50 degrees):
    // Only applied when off-track to prevent steep banks and berms from killing forward momentum
    const slopeAngleCos = contact.normal.y;
    if (slopeAngleCos < 0.6428 && this.isGrounded && this.isOffTrack) {
      const steepnessFactor = (0.6428 - slopeAngleCos) / 0.6428;
      this.speed = Math.max(0, this.speed - (14.0 * steepnessFactor + 8.0) * dt);
      const corridorPull = -Math.sign(this.lateralOffset);
      this.lateralOffset += corridorPull * (7.0 * steepnessFactor + 3.5) * dt;
      // steerAngle is NOT modified - player retains 100% manual steering control
    }

    // Immediate checkpoint trigger plane validation & instant off-track suppression
    trail.checkpoints.forEach((checkpoint, index) => {
      if (Math.abs(this.trackDistance - checkpoint) < 4.0 && this.lastCheckpointPassed < index) {
        this.lastCheckpointPassed = index;
        this.isOffTrack = false;
        this.offTrackTimer = 0;
        soundEngine.playCheckpoint();
        soundEngine.playAirHorn();

        // Calculate UCI World Cup split pace delta (against pro pace ~78s total)
        const expectedPaceSeconds = (checkpoint / Math.max(1, trail.totalLength)) * 78.0;
        const delta = this.elapsedTime - expectedPaceSeconds;
        this.activeSplitDelta = {
          splitIndex: index + 1,
          deltaSeconds: Number(delta.toFixed(2)),
          isAhead: delta <= 0,
        };
        this.splitDeltaTimer = 3.5;

        // Finish line gate crossed: lock inputs and begin run-out deceleration
        if (index === trail.checkpoints.length - 1) {
          this.isFinished = true;
        }
      }
    });

    // Early Advance Cue: Detect approach to upcoming split/finish gate (within 36m)
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

        // Fire audio advance chime once upon entering warning zone (<= 36m)
        if (!this.passedGateCues.has(i)) {
          this.passedGateCues.add(i);
          soundEngine.playSplitApproachCue();
        }
        break;
      }
    }

    // Post-respawn stabilization & invulnerability buffer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }

    // 2. Off-Track Detection with 1.5-Second Grace Window & High Rolling Resistance Buffer
    const isNearGate = trail.checkpoints.some((cp) => Math.abs(this.trackDistance - cp) < 25.0);
    const maxBound = isNearGate ? 12.0 : 6.8;
    if (Math.abs(this.lateralOffset) > maxBound && this.invulnerableTimer <= 0) {
      this.isOffTrack = true;
      this.offTrackTimer += dt;
      // 1.5-second grace window before triggering auto-respawn
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

    // Wooden bridge railing collision with widened collision margins
    if (point.surface === 'wood' || point.type === 'wood_bridge') {
      const bridgeHalfWidth = point.width * 0.5 + 0.45;
      if (Math.abs(this.lateralOffset) > bridgeHalfWidth) {
        const railSide = Math.sign(this.lateralOffset);
        this.lateralOffset = railSide * bridgeHalfWidth;
        this.speed = Math.max(0, this.speed - 2.2);
        soundEngine.playLandingThump(1.8);
      }
    }

    // Obstacle collision check (split gates, banners, trees, rock slabs) - silenced during invulnerability
    if (trail.obstacles && trail.obstacles.length > 0 && this.invulnerableTimer <= 0) {
      for (const obs of trail.obstacles) {
        const distDiff = Math.abs(this.trackDistance - obs.distance);
        if (distDiff < 1.8) {
          const latDiff = Math.abs(this.lateralOffset - obs.lateralOffset);
          const hitRadius = obs.radius + 0.35;
          if (latDiff < hitRadius) {
            if (this.verticalOffset < obs.height + 0.08) {
              if (obs.type === 'stake') {
                // Split / Finish gate pillar: glancing pass-through clip with speed scrub
                // Does NOT cause a run-ending crash wipeout
                const deflect = this.lateralOffset >= obs.lateralOffset ? 1 : -1;
                this.lateralOffset += deflect * 0.55;
                this.speed = Math.max(3.8, this.speed - 3.4); // ~12 km/h scrub
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

    // Lock player input upon crossing the finish gate
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

    // 2. Quadratic Aerodynamic Drag: caps top speed naturally around 75–80 km/h (20.8 - 22.2 m/s)
    const dragCoefficient = controls.tuck ? 0.0044 : 0.0058;
    const aeroDrag = this.speed * this.speed * dragCoefficient;

    // 4. Enforce Off-Track Grass Drag & Lateral Slip:
    // When the raycast detects grass or when the bike's distance from the center trail spline exceeds the track width
    const isOffTrackGrass = !insideRibbon || this.currentSurface === 'grass' || Math.abs(this.lateralOffset) > point.width;
    if (isOffTrackGrass) {
      // Instantly apply a rolling resistance scalar: multiply forward speed by 0.94 every physics step until speed drops below 30 km/h (8.33 m/s)
      if (this.speed > 30 / 3.6) {
        this.speed *= 0.94;
      }

      // Add lateral slip so carving hard on grass causes the bike to slide out rather than cruise smoothly at 80 km/h
      if (Math.abs(this.steerAngle) > 0.04) {
        this.driftFactor = Math.min(1.0, this.driftFactor + Math.abs(this.steerAngle) * 4.0 * dt);
        this.lateralOffset += Math.sign(this.steerAngle) * this.speed * 0.45 * dt;
        this.isSkidding = true;
      }
    }

    const grassResistance = isOffTrackGrass ? (14.0 + this.speed * 0.5) : 0;
    const rolling = (0.18 + this.speed * 0.012) + grassResistance;

    // Damped lateral tire scrub: gentle steering does not kill downhill momentum
    const lateralScrub = this.driftFactor * (this.brakePressure > 0.35 ? 1.5 : 0.45);

    // Steady automatic braking force for safe run-out along 100m flat extension after finish line
    const finishBraking = this.isFinished ? 8.5 : 0;

    this.speed = Math.max(0, this.speed + (9.81 * slope + propulsion - aeroDrag - rolling - braking - finishBraking - lateralScrub) * dt);
    if (this.speed < 0.5 && !controls.pedal && this.trackDistance < 1.5) this.speed = 0;
    this.trackDistance = Math.max(0, Math.min(trail.totalLength, this.trackDistance + this.speed * dt));
    this.wheelRotation -= this.speed * dt / 0.36;

    const groundSlopeVelocity = -this.speed * Math.sin(gradeRad);
    const groundY = contact.position.y;

    // Bunny-hop launch
    if (controls.bunnyHop && this.isGrounded) this.hopCharge = Math.min(1, this.hopCharge + dt * 3);
    else if (!controls.bunnyHop && this.isGrounded && this.hopCharge > 0.15) {
      this.worldVerticalVelocity = groundSlopeVelocity + 3.8 + this.hopCharge * 4.6;
      this.isGrounded = false;
      this.hopCharge = 0; this.jumpsCompleted++; soundEngine.playJumpLaunch();
    } else if (!controls.bunnyHop) this.hopCharge = 0;

    if (!this.isGrounded) {
      this.airTime += dt;
      const gravity = 14.5;
      this.worldVerticalVelocity -= gravity * dt;
      this.worldAltitude += this.worldVerticalVelocity * dt;

      // Bound airborne lateral drift
      this.lateralOffset += this.steerAngle * (this.speed * 0.28 + 1.0) * dt;

      // Uncompress suspension towards top-out while in the air
      this.frontSuspensionCompression += (0.02 - this.frontSuspensionCompression) * Math.min(1, dt * 8);
      this.rearSuspensionCompression += (0.03 - this.rearSuspensionCompression) * Math.min(1, dt * 8);

      // Touchdown collision when worldAltitude reaches ground surface
      if (this.worldAltitude <= groundY) {
        const impactSpeed = Math.abs(this.worldVerticalVelocity - groundSlopeVelocity);
        this.worldAltitude = groundY;
        this.worldVerticalVelocity = 0;
        this.verticalOffset = 0;
        this.isGrounded = true;

        soundEngine.playLandingThump(impactSpeed);
        if (this.airTime > 0.6) this.currentScore += Math.round(this.airTime * 250);
        this.airTime = 0;

        // Dynamic suspension compression on landing:
        // Hard landings compress up to 100% of available travel (170mm fork, 65mm shock)
        const landingForce = Math.min(0.85, impactSpeed * 0.14);
        this.frontSuspensionCompression = Math.min(1.0, this.frontSuspensionCompression + landingForce);
        this.rearSuspensionCompression = Math.min(1.0, this.rearSuspensionCompression + landingForce * 1.1);

        // Snap pitch realistically to terrain slope normal upon landing
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

      // Check for natural launch off crests / kickers at high speed (>40 km/h)
      const nextDist = Math.min(trail.totalLength, this.trackDistance + 1.8);
      const nextPoint = trail.getPointAtDistance(nextDist);
      const heightDrop = point.position.y - nextPoint.position.y;
      if (heightDrop > 0.65 && this.speed > 11 && (point.type === 'jump' || point.type === 'drop' || heightDrop > 1.1)) {
        this.worldVerticalVelocity = Math.max(groundSlopeVelocity, (this.speed - 10) * 0.22 + 2.5);
        this.isGrounded = false;
        soundEngine.playJumpLaunch();
      }

      // Dynamic suspension simulation while rolling:
      // Front wheel raycast distance calculates suspension delta (rest_length - current_distance) on every frame:
      const frontDist = Math.min(trail.totalLength, this.trackDistance + 0.75);
      const frontPoint = trail.getPointAtDistance(frontDist);
      const frontPos = frontPoint.position.clone().addScaledVector(frontPoint.binormal, this.lateralOffset);
      const frontGroundY = trail.getTerrainHeight(frontPos.x, frontPos.z);

      // Rest length from crown down to ground contact under front wheel (0.94m)
      const restLength = 0.94;
      const crownWorldY = this.worldAltitude + 0.88;
      const currentDistance = Math.max(0.68, crownWorldY - frontGroundY);
      // Suspension delta in meters (rest_length - current_distance)
      const suspensionDelta = restLength - currentDistance;
      // Front fork travel fraction (0 to 1.0 for 170mm travel):
      let targetFork = THREE.MathUtils.clamp(0.25 + suspensionDelta / 0.17, 0.0, 1.0);

      // Dynamic weight transfer from front braking:
      targetFork = THREE.MathUtils.clamp(targetFork + this.frontBrakePressure * 0.24, 0.0, 1.0);

      // Rear shock travel delta:
      const rearNormalForceG = Math.max(0.15, contact.normal.y * Math.cos(gradeRad) + this.lateralGForce * 0.4);
      let targetShock = THREE.MathUtils.clamp(0.28 * rearNormalForceG + this.brakePressure * 0.14, 0.0, 1.0);

      // Pumping / berm g-out: adds vertical downforce into fork and shock
      if (controls.pump || this.lateralGForce > 0.8) {
        const pumpLoad = controls.pump ? 0.30 : (this.lateralGForce - 0.8) * 0.25;
        targetFork = THREE.MathUtils.clamp(targetFork + pumpLoad, 0.0, 1.0);
        targetShock = THREE.MathUtils.clamp(targetShock + pumpLoad * 1.1, 0.0, 1.0);
      }

      // High-frequency surface chatter
      const surfaceChatter = point.surface === 'rock' ? (Math.random() - 0.5) * 0.14 : point.surface === 'loose_gravel' ? (Math.random() - 0.5) * 0.06 : 0;
      targetFork = THREE.MathUtils.clamp(targetFork + surfaceChatter, 0.0, 1.0);

      // Spring-damper response (fast compression 28, controlled rebound 14)
      const forkRate = targetFork > this.frontSuspensionCompression ? 28 : 14;
      const shockRate = targetShock > this.rearSuspensionCompression ? 20 : 11;
      this.frontSuspensionCompression = THREE.MathUtils.clamp(
        this.frontSuspensionCompression + (targetFork - this.frontSuspensionCompression) * Math.min(1, dt * forkRate),
        0.0,
        1.0
      );
      this.rearSuspensionCompression = THREE.MathUtils.clamp(
        this.rearSuspensionCompression + (targetShock - this.rearSuspensionCompression) * Math.min(1, dt * shockRate),
        0.0,
        1.0
      );

      this.pitchAngle += ((this.frontSuspensionCompression - this.rearSuspensionCompression) * 0.25 - this.pitchAngle) * Math.min(1, dt * 10);
    }

    // 3. Dynamic Bike Roll & Lean into turns (up to 15-25 degrees = 0.26-0.42 rad)
    const speedRatio = Math.min(1.0, Math.max(0.18, this.speed / 18.0));
    const targetLean = THREE.MathUtils.clamp(
      -this.steerAngle * (0.24 + speedRatio * 0.44) - point.bankAngle * 0.65,
      -0.42,
      0.42
    );
    // Smooth lean blend with lerp factor around 0.08 - 0.12
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

  // 1. Respawn Momentum & Orientation: 25-35 km/h cap, nearest checkpoint, 1s invulnerability
  triggerRespawn(trail: GeneratedTrail) {
    this.isRespawning = true;
    this.respawnTimer = 1.0;
    this.invulnerableTimer = 1.0;
    this.isOffTrack = false;
    this.offTrackTimer = 0;
    this.isCrashed = false;
    this.crashTimer = 0;

    // Cap respawn velocity strictly to 25–35 km/h (28 km/h = 7.78 m/s)
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

    // Find nearest checkpoint along the center spline
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

    // Align the bike's forward vector parallel to track's center spline tangent, facing downhill
    const point = trail.getPointAtDistance(this.trackDistance);
    this.worldAltitude = point.position.y;
    const tangent = point.tangent.clone().normalize();
    const up = point.normal.clone().normalize();
    const right = point.binormal.clone().normalize();
    const basis = new THREE.Matrix4().makeBasis(right, up, tangent.clone().negate());
    this.currentOrientation.setFromRotationMatrix(basis);

    // Camera orientation parallel to the track center spline, facing downhill
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
    // Dynamic yaw heading from steering input: points bike body naturally into manual turns
    const steerYaw = -this.steerAngle * 0.22;
    target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), steerYaw));
    target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitchAngle));
    target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.leanAngle));
    if (!this.isGrounded) target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.airWhipAngle));
    this.currentOrientation.slerp(target, 1 - Math.exp(-18 * dt));
    bikeGroup.quaternion.copy(this.currentOrientation);

    const bikeQuat = bikeGroup.quaternion;
    if (cameraView === 'first_person_helmet') {
      // Eye level: 1.14m above ground contact, slightly forward (0.12m)
      const eyeOffset = new THREE.Vector3(0, 1.14, 0.12).applyQuaternion(bikeQuat);
      const targetCamPos = groundPos.clone().add(eyeOffset);
      this.camPos.lerp(targetCamPos, 1 - Math.exp(-25 * dt));

      // Look direction: forward down the trail (-Z in bike local frame), pitched down so front wheel & fork crown are visible
      const lookOffset = new THREE.Vector3(0, 0.60, -12.0).applyQuaternion(bikeQuat);
      const targetLookAt = groundPos.clone().add(lookOffset);
      this.camLookAt.lerp(targetLookAt, 1 - Math.exp(-18 * dt));

      // Dynamic Camera Banking with smooth 0.08 - 0.12 lerp factor
      const bikeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(bikeQuat);
      const stabilizedUp = new THREE.Vector3(0, 1, 0).lerp(bikeUp, 0.38).normalize();
      const cameraRollLerp = THREE.MathUtils.clamp(dt * 6.5, 0.08, 0.12);
      this.camUp.lerp(stabilizedUp, cameraRollLerp);
    } else if (cameraView === 'first_person_stem') {
      const targetCamPos = groundPos.clone().add(new THREE.Vector3(0, 0.98, -0.22).applyQuaternion(bikeQuat));
      const targetLookAt = groundPos.clone().add(new THREE.Vector3(0, 0.8, -14).applyQuaternion(bikeQuat));
      this.camPos.lerp(targetCamPos, 1 - Math.exp(-24 * dt));
      this.camLookAt.lerp(targetLookAt, 1 - Math.exp(-20 * dt));

      const bikeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(bikeQuat);
      const stabilizedUp = new THREE.Vector3(0, 1, 0).lerp(bikeUp, 0.42).normalize();
      const cameraRollLerp = THREE.MathUtils.clamp(dt * 6.5, 0.08, 0.12);
      this.camUp.lerp(stabilizedUp, cameraRollLerp);
    } else {
      // Third-person Chase Camera with Dynamic Over-The-Shoulder Action Framing
      const focusPos = groundPos.clone().add(new THREE.Vector3(0, 1.05, 0));
      const idealOffset = new THREE.Vector3(0.28, 1.48, 3.2).applyQuaternion(bikeQuat);
      const targetCamPos = groundPos.clone().add(idealOffset);

      // Dynamic Camera Banking for Chase Camera (smooth 0.08 - 0.12 lerp)
      const bikeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(bikeQuat);
      const stabilizedUp = new THREE.Vector3(0, 1, 0).lerp(bikeUp, 0.32).normalize();
      const cameraRollLerp = THREE.MathUtils.clamp(dt * 6.5, 0.08, 0.12);
      this.camUp.lerp(stabilizedUp, cameraRollLerp);

      // Spring-Arm Line of Sight raycast along boom from rider focus out to camera
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

      // Check ground clearance directly under ideal camera spot
      const camGroundH = trail.getTerrainHeight(targetCamPos.x, targetCamPos.z) + 0.65;
      if (targetCamPos.y < camGroundH) {
        targetCamPos.y = camGroundH;
      }

      this.camPos.lerp(targetCamPos, 1 - Math.exp(-14 * dt));
      this.camLookAt.lerp(groundPos.clone().add(new THREE.Vector3(0.06, 0.72, -4.2).applyQuaternion(bikeQuat)), 1 - Math.exp(-15 * dt));
    }

    // Universal Anti-Clip: Enforce hard floor clearance above terrain for all camera modes
    const safeFloorY = trail.getTerrainHeight(this.camPos.x, this.camPos.z) + 0.45;
    if (this.camPos.y < safeFloorY) {
      this.camPos.y = safeFloorY;
    }

    // Dynamic trauma shake during crash sequence
    if (this.isCrashed) {
      const shakeMag = Math.max(0, (1.5 - this.crashTimer) / 1.5) * 0.42;
      this.camPos.x += (Math.random() - 0.5) * shakeMag;
      this.camPos.y += (Math.random() - 0.5) * shakeMag;
      this.camPos.z += (Math.random() - 0.5) * shakeMag;
      if (this.camPos.y < safeFloorY) {
        this.camPos.y = safeFloorY;
      }
    } else if (this.isGrounded && this.speed > 8.0) {
      // High-speed and rough surface camera micro-rumble for realistic physical pacing
      const rumbleIntensity = Math.min(0.024, (this.speed / 26.0) * (point.surface === 'rock' ? 0.022 : 0.012));
      this.camPos.x += (Math.random() - 0.5) * rumbleIntensity;
      this.camPos.y += (Math.random() - 0.5) * rumbleIntensity;
    }

    // 4. Smooth Camera Lean (Lerp):
    // Smoothly transitions camera roll towards target lean angle while steering, and smoothly back to center when going straight
    const speedRatio = Math.min(1.0, this.speed / 18.0);
    const targetCameraRoll = -this.steerAngle * (0.16 + speedRatio * 0.20);
    this.currentCameraRoll = THREE.MathUtils.lerp(
      this.currentCameraRoll,
      targetCameraRoll,
      THREE.MathUtils.clamp(dt * 5.5, 0.06, 0.12)
    );

    if (cameraView !== 'chase_cam') {
      camera.position.copy(this.camPos);
      camera.up.copy(this.camUp);
      camera.lookAt(this.camLookAt);
      camera.rotation.z += this.currentCameraRoll;
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      const baseFov = cameraView === 'first_person_helmet' ? 82 : cameraView === 'first_person_stem' ? 76 : 70;
      // Dynamic high-speed adrenaline FOV expansion (widens by 12-16 degrees as speed climbs above 55 km/h)
      const speedKmh = this.speed * 3.6;
      const speedWarp = Math.min(15, Math.max(0, (speedKmh - 50) / 40 * 15));
      const targetFov = baseFov + speedWarp;
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-8 * dt));
      camera.updateProjectionMatrix();
    }
  }

  getTelemetry(trail: GeneratedTrail): TelemetryData {
    const point = trail.getPointAtDistance(this.trackDistance);
    const clampedFork = THREE.MathUtils.clamp(Number(this.frontSuspensionCompression.toFixed(3)), 0, 1.0);
    const clampedShock = THREE.MathUtils.clamp(Number(this.rearSuspensionCompression.toFixed(3)), 0, 1.0);
    return {
      speedKmh: this.speed * 3.6, speedMph: this.speed * 2.237, rpm: Math.round(this.speed * 18), gear: this.currentGear, maxGear: this.maxGear,
      cadence: Math.round(this.speed * 4.2), elevation: Math.round(point.position.y), elevationDrop: Math.round(trail.getPointAtDistance(0).position.y - point.position.y),
      gradePercentage: Math.round(Math.tan(point.grade * Math.PI / 180) * 100), frontForkTravelPercent: clampedFork, rearShockTravelPercent: clampedShock,
      gForce: Number(Math.sqrt(1 + this.lateralGForce ** 2).toFixed(1)), leanAngleDeg: Math.round(this.leanAngle * 180 / Math.PI), isGrounded: this.isGrounded,
      airTimeSeconds: Number(this.airTime.toFixed(2)), jumpCount: this.jumpsCompleted, distanceCoveredMeters: Math.round(this.trackDistance), totalDistanceMeters: Math.round(trail.totalLength),
      progressPercent: Math.min(100, Math.round(this.trackDistance / trail.totalLength * 100)), elapsedTime: Number(this.elapsedTime.toFixed(2)), currentCheckPoint: Math.max(0, this.lastCheckpointPassed + 1), totalCheckPoints: trail.checkpoints.length,
      crashState: this.isCrashed, score: this.currentScore, streak: Math.min(10, Math.floor(this.currentScore / 500)), stuntName: this.stuntName, surfaceName: this.currentSurface,
      frontBrakePressure: this.frontBrakePressure, rearBrakePressure: this.brakePressure, driftPercent: Math.round(this.driftFactor * 100), pumpReady: this.pumpReady,
      isOffTrack: this.isOffTrack, offTrackSeconds: Number(this.offTrackTimer.toFixed(1)), isRespawning: this.isRespawning,
      splitDelta: this.activeSplitDelta,
      approachingGate: this.activeApproachingGate,
    };
  }
}
