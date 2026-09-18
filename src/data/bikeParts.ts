import { BikeCustomization, BikeStats, FrameType, ForkType, ShockType, TireCompound, BrakeType } from '../types/game';

export const FRAME_OPTIONS = [
  {
    id: 'carbon_enduro' as FrameType,
    name: 'AeroCarbon DH-9',
    category: 'Carbon Monocoque',
    weightKg: 2.8,
    stiffness: 0.95,
    description: 'Ultra-lightweight high modulus carbon fiber. Exceptional responsiveness and razor-sharp line choice.',
    colors: ['#0f172a', '#ea580c', '#0284c7', '#16a34a', '#e11d48', '#f8fafc'],
  },
  {
    id: 'alloy_dh' as FrameType,
    name: 'HydroAlloy Beast 200',
    category: 'Hydroformed 6061-T6',
    weightKg: 4.1,
    stiffness: 0.82,
    description: 'Bombproof extruded aluminum frame. Forgiving flex over chattery rock gardens with maximum durability.',
    colors: ['#475569', '#d97706', '#059669', '#7c3aed', '#dc2626'],
  },
  {
    id: 'titanium_freeride' as FrameType,
    name: 'TitanCraft Savage 210',
    category: 'Grade 9 3Al-2.5V Titanium',
    weightKg: 3.4,
    stiffness: 0.90,
    description: 'Artisanal titanium construction. Natural vibration dampening with unmatched strength-to-weight ratio.',
    colors: ['#94a3b8', '#ca8a04', '#0d9488', '#2563eb', '#1e293b'],
  },
];

export const FORK_OPTIONS = [
  {
    id: 'air_trophy_200' as ForkType,
    name: 'AeroAir 40 Factory 200mm',
    travelMm: 203,
    stiffness: 0.85,
    damping: 0.92,
    weightKg: 2.7,
    description: 'Float EVOL air spring with Grip2 VVC damper. High and low-speed rebound & compression tuning.',
    colors: ['#ea580c', '#0f172a', '#e2e8f0', '#ca8a04'],
  },
  {
    id: 'coil_beast_200' as ForkType,
    name: 'Boxxer Ultimate Coil 200mm',
    travelMm: 200,
    stiffness: 0.92,
    damping: 0.88,
    weightKg: 3.1,
    description: 'Linear titanium coil spring for buttery smooth small-bump sensitivity and endless bottom-out resistance.',
    colors: ['#dc2626', '#1e293b', '#0284c7'],
  },
  {
    id: 'inverted_factory' as ForkType,
    name: 'Intend Infinity USD 215mm',
    travelMm: 215,
    stiffness: 0.96,
    damping: 0.95,
    weightKg: 2.9,
    description: 'Upside-down motocross-derived architecture. Unrivaled torsional rigidity and lower unsprung mass.',
    colors: ['#0f172a', '#eab308', '#22c55e'],
  },
];

export const SHOCK_OPTIONS = [
  {
    id: 'coil_dhx' as ShockType,
    name: 'DHX2 Factory Steel Coil',
    travelMm: 75, // stroke
    reboundDamping: 0.92,
    description: 'Externally adjustable high/low speed compression & rebound. Consistent plush damping on long descents.',
    coilColors: ['#ea580c', '#eab308', '#dc2626', '#f8fafc', '#22c55e'],
  },
  {
    id: 'air_float_x2' as ShockType,
    name: 'Float X2 High-Volume Air',
    travelMm: 75,
    reboundDamping: 0.88,
    description: 'Twin-tube air reservoir with progressive ramp-up. Saves 450g while offering endless bottom-out support.',
    coilColors: ['#0f172a', '#ca8a04', '#475569'],
  },
  {
    id: 'remote_lockout' as ShockType,
    name: 'SuperDeluxe Coil Ultimate',
    travelMm: 75,
    reboundDamping: 0.90,
    description: 'Hydraulic bottom-out damper with rapid recovery circuit. Perfect for huge sends and brutal rock drops.',
    coilColors: ['#e11d48', '#2563eb', '#0f172a'],
  },
];

export const TIRE_OPTIONS = [
  {
    id: 'max_grip_dh' as TireCompound,
    name: 'Assegai 3C MaxxGrip 2.5"',
    grip: 0.96,
    rollingResistance: 0.45,
    mudTraction: 0.85,
    widthInch: 2.5,
    description: 'Sticky downhill compound with aggressive side knobs. Maximum cornering bite in loose dust & berms.',
  },
  {
    id: 'all_mountain' as TireCompound,
    name: 'Minion DHF / DHR II 2.4"',
    grip: 0.88,
    rollingResistance: 0.30,
    mudTraction: 0.80,
    widthInch: 2.4,
    description: 'The benchmark all-mountain combo. Great rollover speed with predictable drifting threshold.',
  },
  {
    id: 'semi_slick' as TireCompound,
    name: 'Rock Razor Speed DH 2.35"',
    grip: 0.74,
    rollingResistance: 0.15,
    mudTraction: 0.50,
    widthInch: 2.35,
    description: 'Fast center tread with big cornering rails. Insane top speed down hard-packed flow highways.',
  },
  {
    id: 'mud_spikes' as TireCompound,
    name: 'WetScream Mud Spike 2.5"',
    grip: 0.90,
    rollingResistance: 0.55,
    mudTraction: 0.98,
    widthInch: 2.5,
    description: 'Deep square spikes designed to slice through wet loam, deep mud, and slimy roots.',
  },
];

export const BRAKE_OPTIONS = [
  {
    id: 'ice_carbon_220' as BrakeType,
    name: 'Magura MT7 Pro 220mm HC3',
    power: 0.98,
    fadeResistance: 0.95,
    rotorSizeMm: 220,
    description: '4-piston radial caliper with 220mm floating rotor. One-finger braking capable of stopping on vertical drops.',
  },
  {
    id: 'quad_hydraulic' as BrakeType,
    name: 'Shimano Saint M820 203mm',
    power: 0.90,
    fadeResistance: 0.90,
    rotorSizeMm: 203,
    description: 'Gold-standard ceramic quad pistons with Ice-Technologies heat dissipation fins.',
  },
  {
    id: 'dual_trail' as BrakeType,
    name: 'SRAM Code RSC 200mm',
    power: 0.85,
    fadeResistance: 0.85,
    rotorSizeMm: 200,
    description: 'Smooth modulation and contact-point adjust. Great progressive brake control for feathered speed checks.',
  },
];

export const DEFAULT_BIKE: BikeCustomization = {
  frame: {
    id: 'carbon_enduro',
    name: 'AeroCarbon DH-9',
    color: '#ea580c', // iconic Fox orange / racing orange
    weightKg: 2.8,
    stiffness: 0.95,
  },
  fork: {
    id: 'air_trophy_200',
    name: 'AeroAir 40 Factory 200mm',
    travelMm: 203,
    stiffness: 0.85,
    damping: 0.92,
    color: '#ea580c',
  },
  shock: {
    id: 'coil_dhx',
    name: 'DHX2 Factory Steel Coil',
    travelMm: 75,
    reboundDamping: 0.92,
    coilColor: '#ea580c',
  },
  tires: {
    id: 'max_grip_dh',
    name: 'Assegai 3C MaxxGrip 2.5"',
    grip: 0.96,
    rollingResistance: 0.45,
    mudTraction: 0.85,
    widthInch: 2.5,
  },
  brakes: {
    id: 'ice_carbon_220',
    name: 'Magura MT7 Pro 220mm HC3',
    power: 0.98,
    fadeResistance: 0.95,
    rotorSizeMm: 220,
  },
  cockpit: {
    barWidth: 800,
    barColor: '#0f172a',
    gripColor: '#ea580c',
    stemLengthMm: 45,
  },
  wheels: {
    size: 'mullet',
    rimColor: '#1e293b',
  },
};

export function calculateBikeStats(bike: BikeCustomization): BikeStats {
  const totalWeight = 11.5 + bike.frame.weightKg + (bike.fork.id === 'coil_beast_200' ? 0.6 : 0) + (bike.wheels.size === '29' ? 0.4 : 0);
  
  // Acceleration is inversely proportional to rolling resistance and weight
  const acceleration = Math.max(30, Math.round(95 - (totalWeight * 2.2) - (bike.tires.rollingResistance * 25)));
  
  // Top speed depends on wheel size, rolling resistance, and frame aero
  const topSpeedKmh = Math.round(68 + (bike.wheels.size === '29' ? 6 : bike.wheels.size === 'mullet' ? 3 : 0) - (bike.tires.rollingResistance * 12) + (bike.frame.stiffness * 5));
  
  // Grip score based on tires and tire width
  const gripScore = Math.round(bike.tires.grip * 90 + (bike.tires.widthInch - 2.3) * 30);
  
  // Suspension plushness
  const suspensionPlushness = Math.round((bike.fork.travelMm / 200) * 45 + bike.fork.damping * 25 + bike.shock.reboundDamping * 25);
  
  // Braking power
  const brakingPower = Math.round(bike.brakes.power * 85 + (bike.brakes.rotorSizeMm / 220) * 15);
  
  // Air control (lighter bike + wider bars = better whip/balance)
  const airControl = Math.round((bike.cockpit.barWidth / 800) * 50 + (17 - totalWeight) * 4 + (bike.wheels.size === '27.5' ? 12 : 5));

  return {
    weight: Number(totalWeight.toFixed(1)),
    topSpeedKmh,
    acceleration,
    gripScore,
    suspensionPlushness,
    brakingPower,
    airControl,
  };
}
