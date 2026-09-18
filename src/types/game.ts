export type FrameType = 'carbon_enduro' | 'alloy_dh' | 'titanium_freeride';
export type ForkType = 'air_trophy_200' | 'coil_beast_200' | 'inverted_factory';
export type ShockType = 'air_float_x2' | 'coil_dhx' | 'remote_lockout';
export type TireCompound = 'max_grip_dh' | 'all_mountain' | 'semi_slick' | 'mud_spikes';
export type BrakeType = 'quad_hydraulic' | 'ice_carbon_220' | 'dual_trail';
export type HandlebarWidth = 760 | 780 | 800 | 820;

export interface BikeCustomization {
  frame: {
    id: FrameType;
    name: string;
    color: string;
    weightKg: number;
    stiffness: number; // 0-1
  };
  fork: {
    id: ForkType;
    name: string;
    travelMm: number;
    stiffness: number; // spring rate
    damping: number;
    color: string;
  };
  shock: {
    id: ShockType;
    name: string;
    travelMm: number;
    reboundDamping: number;
    coilColor: string;
  };
  tires: {
    id: TireCompound;
    name: string;
    grip: number;
    rollingResistance: number;
    mudTraction: number;
    widthInch: number;
  };
  brakes: {
    id: BrakeType;
    name: string;
    power: number;
    fadeResistance: number;
    rotorSizeMm: number;
  };
  cockpit: {
    barWidth: HandlebarWidth;
    barColor: string;
    gripColor: string;
    stemLengthMm: number;
  };
  wheels: {
    size: '27.5' | '29' | 'mullet'; // mullet = 29 front, 27.5 rear
    rimColor: string;
  };
}

export interface BikeStats {
  weight: number; // kg
  topSpeedKmh: number;
  acceleration: number;
  gripScore: number;
  suspensionPlushness: number;
  brakingPower: number;
  airControl: number;
}

export interface TelemetryData {
  speedKmh: number;
  speedMph: number;
  rpm: number;
  gear: number;
  maxGear: number;
  cadence: number;
  elevation: number;
  elevationDrop: number;
  gradePercentage: number;
  frontForkTravelPercent: number; // 0 to 1
  rearShockTravelPercent: number; // 0 to 1
  gForce: number;
  leanAngleDeg: number;
  isGrounded: boolean;
  airTimeSeconds: number;
  jumpCount: number;
  distanceCoveredMeters: number;
  totalDistanceMeters: number;
  progressPercent: number;
  elapsedTime: number; // seconds
  currentCheckPoint: number;
  totalCheckPoints: number;
  crashState: boolean;
  score: number;
  streak: number;
  stuntName: string;
  surfaceName: string;
  frontBrakePressure: number; // 0 to 1
  rearBrakePressure: number; // 0 to 1
  driftPercent: number; // 0 to 100
  pumpReady: boolean;
}

export interface TrackWaypoint {
  x: number;
  y: number; // elevation
  z: number;
  width: number;
  bankAngle: number; // tilt of berm in radians
  type: 'straight' | 'berm' | 'jump' | 'rock_garden' | 'wood_bridge' | 'drop';
  surface: 'dirt' | 'loose_gravel' | 'wood' | 'rock';
}

export interface TrackData {
  id: string;
  name: string;
  subtitle: string;
  difficulty: 'Green (Flow)' | 'Blue (Intermediate)' | 'Black Diamond (Expert)' | 'Pro Downhill';
  lengthMeters: number;
  elevationDropMeters: number;
  averageGrade: string;
  skyColor: number;
  fogColor: number;
  sunColor: number;
  groundColor: number;
  rockDensity: number;
  treeDensity: number;
  description: string;
  recordTime: number; // seconds
}

export type CameraView = 'first_person_helmet' | 'first_person_stem' | 'chase_cam';

export type GameState = 'RACING' | 'GARAGE' | 'PAUSED' | 'FINISHED' | 'CRASHED';
