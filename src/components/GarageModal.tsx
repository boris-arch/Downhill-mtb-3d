import React, { useState } from 'react';
import { BikeCustomization, BikeStats, FrameType, ForkType, ShockType, TireCompound, BrakeType } from '../types/game';
import { 
  FRAME_OPTIONS, 
  FORK_OPTIONS, 
  SHOCK_OPTIONS, 
  TIRE_OPTIONS, 
  BRAKE_OPTIONS, 
  calculateBikeStats 
} from '../data/bikeParts';
import { 
  X, 
  Check, 
  Shield, 
  Disc, 
  Gauge, 
  Activity, 
  Sliders, 
  Paintbrush, 
  CircleDot, 
  Flame, 
  Award,
  Play
} from 'lucide-react';

interface GarageModalProps {
  currentBike: BikeCustomization;
  onSaveBike: (bike: BikeCustomization) => void;
  onClose: () => void;
}

type TabType = 'frame' | 'fork' | 'shock' | 'tires' | 'brakes' | 'cockpit';

export const GarageModal: React.FC<GarageModalProps> = ({
  currentBike,
  onSaveBike,
  onClose,
}) => {
  const [bike, setBike] = useState<BikeCustomization>({ ...currentBike });
  const [activeTab, setActiveTab] = useState<TabType>('frame');

  const stats: BikeStats = calculateBikeStats(bike);
  const originalStats: BikeStats = calculateBikeStats(currentBike);

  const handleFrameChange = (frameId: FrameType) => {
    const opt = FRAME_OPTIONS.find((f) => f.id === frameId);
    if (!opt) return;
    setBike((prev) => ({
      ...prev,
      frame: {
        id: opt.id,
        name: opt.name,
        color: prev.frame.color,
        weightKg: opt.weightKg,
        stiffness: opt.stiffness,
      },
    }));
  };

  const handleForkChange = (forkId: ForkType) => {
    const opt = FORK_OPTIONS.find((f) => f.id === forkId);
    if (!opt) return;
    setBike((prev) => ({
      ...prev,
      fork: {
        id: opt.id,
        name: opt.name,
        travelMm: opt.travelMm,
        stiffness: opt.stiffness,
        damping: opt.damping,
        color: prev.fork.color,
      },
    }));
  };

  const handleShockChange = (shockId: ShockType) => {
    const opt = SHOCK_OPTIONS.find((s) => s.id === shockId);
    if (!opt) return;
    setBike((prev) => ({
      ...prev,
      shock: {
        id: opt.id,
        name: opt.name,
        travelMm: opt.travelMm,
        reboundDamping: opt.reboundDamping,
        coilColor: prev.shock.coilColor,
      },
    }));
  };

  const handleTireChange = (tireId: TireCompound) => {
    const opt = TIRE_OPTIONS.find((t) => t.id === tireId);
    if (!opt) return;
    setBike((prev) => ({
      ...prev,
      tires: {
        id: opt.id,
        name: opt.name,
        grip: opt.grip,
        rollingResistance: opt.rollingResistance,
        mudTraction: opt.mudTraction,
        widthInch: opt.widthInch,
      },
    }));
  };

  const handleBrakeChange = (brakeId: BrakeType) => {
    const opt = BRAKE_OPTIONS.find((b) => b.id === brakeId);
    if (!opt) return;
    setBike((prev) => ({
      ...prev,
      brakes: {
        id: opt.id,
        name: opt.name,
        power: opt.power,
        fadeResistance: opt.fadeResistance,
        rotorSizeMm: opt.rotorSizeMm,
      },
    }));
  };

  const currentFrameOption = FRAME_OPTIONS.find((f) => f.id === bike.frame.id) || FRAME_OPTIONS[0];
  const currentShockOption = SHOCK_OPTIONS.find((s) => s.id === bike.shock.id) || SHOCK_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 select-none overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/10 border border-orange-500/30 rounded-xl">
              <Sliders className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">Bike Garage & Tuning</h2>
              <p className="text-xs text-slate-400">Configure downhill geometry, suspension travel, and tire compounds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Container */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Navigation Tabs */}
          <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-slate-800 p-3 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible">
            {[
              { id: 'frame', label: 'Frame & Paint', icon: Shield },
              { id: 'fork', label: 'Fork Suspension', icon: Activity },
              { id: 'shock', label: 'Rear Shock', icon: CircleDot },
              { id: 'tires', label: 'Tires & Wheels', icon: Disc },
              { id: 'brakes', label: 'Hydraulic Brakes', icon: Flame },
              { id: 'cockpit', label: 'Cockpit & Grips', icon: Paintbrush },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition text-left ${
                    isActive
                      ? 'bg-orange-500 text-slate-950 shadow-md font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Center/Right: Selection Panel */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
            {/* FRAME TAB */}
            {activeTab === 'frame' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Downhill Frame Architecture</h3>
                  <p className="text-xs text-slate-400">Select material and stiffness profile</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {FRAME_OPTIONS.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => handleFrameChange(f.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                        bike.frame.id === f.id
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-white">{f.name}</span>
                          {bike.frame.id === f.id && <Check className="w-4 h-4 text-orange-400" />}
                        </div>
                        <div className="text-[10px] text-orange-400 font-mono mb-2">{f.category}</div>
                        <p className="text-xs text-slate-400 leading-relaxed">{f.description}</p>
                      </div>
                      <div className="mt-4 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-300 flex justify-between">
                        <span>Weight: {f.weightKg}kg</span>
                        <span>Stiffness: {Math.round(f.stiffness * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paint Colors */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Frame Custom Paint</h4>
                  <div className="flex items-center gap-3">
                    {currentFrameOption.colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setBike((prev) => ({ ...prev, frame: { ...prev.frame, color: c } }))}
                        className={`w-8 h-8 rounded-full border-2 transition transform hover:scale-110 ${
                          bike.frame.color === c ? 'border-white scale-110 shadow-lg' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* FORK TAB */}
            {activeTab === 'fork' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Front Suspension Fork (200mm)</h3>
                  <p className="text-xs text-slate-400">High-speed compression damper & air/coil spring systems</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {FORK_OPTIONS.map((fk) => (
                    <div
                      key={fk.id}
                      onClick={() => handleForkChange(fk.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                        bike.fork.id === fk.id
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-white">{fk.name}</span>
                          {bike.fork.id === fk.id && <Check className="w-4 h-4 text-orange-400" />}
                        </div>
                        <div className="text-[10px] text-orange-400 font-mono mb-2">Travel: {fk.travelMm}mm</div>
                        <p className="text-xs text-slate-400 leading-relaxed">{fk.description}</p>
                      </div>
                      <div className="mt-4 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-300 flex justify-between">
                        <span>Damping: {Math.round(fk.damping * 100)}%</span>
                        <span>Spring: {Math.round(fk.stiffness * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Lower Legs Color */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Lower Legs Finish</h4>
                  <div className="flex items-center gap-3">
                    {['#ea580c', '#0f172a', '#dc2626', '#e2e8f0'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setBike((prev) => ({ ...prev, fork: { ...prev.fork, color: c } }))}
                        className={`w-8 h-8 rounded-full border-2 transition transform hover:scale-110 ${
                          bike.fork.color === c ? 'border-white scale-110' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SHOCK TAB */}
            {activeTab === 'shock' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Rear Shock Damper</h3>
                  <p className="text-xs text-slate-400">Twin-tube air vs titanium coil springs</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SHOCK_OPTIONS.map((sk) => (
                    <div
                      key={sk.id}
                      onClick={() => handleShockChange(sk.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                        bike.shock.id === sk.id
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-white">{sk.name}</span>
                          {bike.shock.id === sk.id && <Check className="w-4 h-4 text-orange-400" />}
                        </div>
                        <div className="text-[10px] text-orange-400 font-mono mb-2">Stroke: {sk.travelMm}mm</div>
                        <p className="text-xs text-slate-400 leading-relaxed">{sk.description}</p>
                      </div>
                      <div className="mt-4 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-300">
                        <span>Rebound Damp: {Math.round(sk.reboundDamping * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coil Spring Color */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Coil Spring Color</h4>
                  <div className="flex items-center gap-3">
                    {currentShockOption.coilColors.map((c) => (
                      <button
                        key={c}
                        onClick={() => setBike((prev) => ({ ...prev, shock: { ...prev.shock, coilColor: c } }))}
                        className={`w-8 h-8 rounded-full border-2 transition transform hover:scale-110 ${
                          bike.shock.coilColor === c ? 'border-white scale-110' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TIRES TAB */}
            {activeTab === 'tires' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Tire Compound & Tread</h3>
                  <p className="text-xs text-slate-400">Balance rolling speed with loose cornering bite</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TIRE_OPTIONS.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleTireChange(t.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition ${
                        bike.tires.id === t.id
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-white">{t.name}</span>
                        {bike.tires.id === t.id && <Check className="w-4 h-4 text-orange-400" />}
                      </div>
                      <p className="text-xs text-slate-400 mb-3">{t.description}</p>
                      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-300">
                        <div>Grip: {Math.round(t.grip * 100)}%</div>
                        <div>Rolling: {Math.round(t.rollingResistance * 100)}%</div>
                        <div>Mud Bite: {Math.round(t.mudTraction * 100)}%</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Wheel Diameter Setup */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Wheelset Configuration</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'mullet', label: 'Mullet (29" F / 27.5" R)', desc: 'Fast rollover front + snappy agile cornering rear' },
                      { id: '29', label: 'Full 29er', desc: 'Maximum monster truck obstacle rollover & top speed' },
                      { id: '27.5', label: 'Full 27.5"', desc: 'Maximum flickability and playful jump whips' },
                    ].map((w) => (
                      <button
                        key={w.id}
                        onClick={() => setBike((prev) => ({ ...prev, wheels: { ...prev.wheels, size: w.id as any } }))}
                        className={`p-3 rounded-xl border text-left transition ${
                          bike.wheels.size === w.id
                            ? 'border-orange-500 bg-orange-500/10'
                            : 'border-slate-800 bg-slate-950/40'
                        }`}
                      >
                        <div className="text-xs font-bold text-white mb-0.5">{w.label}</div>
                        <div className="text-[10px] text-slate-400">{w.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* BRAKES TAB */}
            {activeTab === 'brakes' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Hydraulic Quad-Piston Brakes</h3>
                  <p className="text-xs text-slate-400">Rotor size and thermal fade resistance</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {BRAKE_OPTIONS.map((brk) => (
                    <div
                      key={brk.id}
                      onClick={() => handleBrakeChange(brk.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                        bike.brakes.id === brk.id
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-white">{brk.name}</span>
                          {bike.brakes.id === brk.id && <Check className="w-4 h-4 text-orange-400" />}
                        </div>
                        <div className="text-[10px] text-orange-400 font-mono mb-2">Rotor: {brk.rotorSizeMm}mm</div>
                        <p className="text-xs text-slate-400 leading-relaxed">{brk.description}</p>
                      </div>
                      <div className="mt-4 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-300 flex justify-between">
                        <span>Power: {Math.round(brk.power * 100)}%</span>
                        <span>Fade: {Math.round(brk.fadeResistance * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COCKPIT TAB */}
            {activeTab === 'cockpit' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Handlebars & Grips</h3>
                  <p className="text-xs text-slate-400">Cockpit dimensions dictate first-person leverage & steering speed</p>
                </div>

                {/* Handlebar Width */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Bar Width</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {[760, 780, 800, 820].map((w) => (
                      <button
                        key={w}
                        onClick={() => setBike((prev) => ({ ...prev, cockpit: { ...prev.cockpit, barWidth: w as any } }))}
                        className={`py-2 rounded-xl border text-xs font-mono font-bold transition ${
                          bike.cockpit.barWidth === w
                            ? 'border-orange-500 bg-orange-500 text-slate-950'
                            : 'border-slate-800 bg-slate-950/40 text-slate-300'
                        }`}
                      >
                        {w}mm
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grip Color */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Grip Color</h4>
                  <div className="flex items-center gap-3">
                    {['#ea580c', '#0284c7', '#22c55e', '#e11d48', '#0f172a', '#f8fafc'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setBike((prev) => ({ ...prev, cockpit: { ...prev.cockpit, gripColor: c } }))}
                        className={`w-8 h-8 rounded-full border-2 transition transform hover:scale-110 ${
                          bike.cockpit.gripColor === c ? 'border-white scale-110' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Stats Comparative Display */}
            <div className="mt-auto bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Performance Telemetry</span>
                <span className="font-mono text-orange-400">{stats.weight} kg Total Weight</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Top Speed', value: stats.topSpeedKmh, orig: originalStats.topSpeedKmh, unit: 'km/h' },
                  { label: 'Acceleration', value: stats.acceleration, orig: originalStats.acceleration, unit: '%' },
                  { label: 'Traction / Grip', value: stats.gripScore, orig: originalStats.gripScore, unit: 'pts' },
                  { label: 'Plushness', value: stats.suspensionPlushness, orig: originalStats.suspensionPlushness, unit: 'pts' },
                  { label: 'Brake Power', value: stats.brakingPower, orig: originalStats.brakingPower, unit: '%' },
                  { label: 'Air Control', value: stats.airControl, orig: originalStats.airControl, unit: '%' },
                ].map((s) => {
                  const diff = s.value - s.orig;
                  return (
                    <div key={s.label} className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>{s.label}</span>
                        {diff !== 0 && (
                          <span className={diff > 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-sm font-bold text-white">
                        {s.value} <span className="text-[10px] text-slate-400 font-normal">{s.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            id="apply-bike-customization-btn"
            onClick={() => {
              onSaveBike(bike);
              onClose();
            }}
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-slate-950" /> Apply Setup & Ride
          </button>
        </div>
      </div>
    </div>
  );
};
