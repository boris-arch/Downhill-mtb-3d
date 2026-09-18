import React from 'react';
import { TelemetryData, CameraView } from '../types/game';
import { 
  Volume2, 
  VolumeX, 
  Camera, 
  RotateCcw, 
  Pause, 
  Wrench, 
  Compass, 
  Activity, 
  Zap, 
  ChevronUp, 
  ArrowDown, 
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Gamepad2
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface HUDProps {
  telemetry: TelemetryData;
  cameraView: CameraView;
  onCycleCamera: () => void;
  onResetTrack: () => void;
  onOpenGarage: () => void;
  onPause: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onControlInput: (key: string, pressed: boolean) => void;
}

export const HUD: React.FC<HUDProps> = ({
  telemetry,
  cameraView,
  onCycleCamera,
  onResetTrack,
  onOpenGarage,
  onPause,
  isMuted,
  onToggleMute,
  onControlInput,
}) => {
  const [showControls, setShowControls] = React.useState<boolean>(true);
  const speedPercentage = Math.min(100, (telemetry.speedKmh / 75) * 100);

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-3 sm:p-5 md:p-6 overflow-hidden">
      {/* Top Status Bar: Responsive splits with clean spacing */}
      <div className="w-full flex items-start justify-between gap-2 z-20">
        {/* Left: Timing & Progress */}
        <div className="flex flex-col gap-1.5 bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-xl pointer-events-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-orange-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> Split {telemetry.currentCheckPoint}/{telemetry.totalCheckPoints}
            </span>
            <span className="text-slate-400 text-xs">|</span>
            <span className="font-mono text-xs sm:text-sm font-semibold text-white">
              {Math.floor(telemetry.elapsedTime / 60)}:
              {String(Math.floor(telemetry.elapsedTime % 60)).padStart(2, '0')}.
              {String(Math.floor((telemetry.elapsedTime % 1) * 100)).padStart(2, '0')}
            </span>
          </div>

          {/* Trail Distance Progress Bar */}
          <div className="w-36 sm:w-52 md:w-60 flex flex-col gap-1">
            <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-400 font-mono">
              <span>{telemetry.distanceCoveredMeters}m</span>
              <span>{telemetry.totalDistanceMeters}m</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-100"
                style={{ width: `${telemetry.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center: Stunt / Notification Toast */}
        {telemetry.stuntName && (
          <div className="pointer-events-none flex flex-col items-center animate-bounce mx-auto">
            <div className="bg-orange-500 text-black font-black text-xs md:text-sm px-3 sm:px-4 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black" /> {telemetry.stuntName}
            </div>
            {telemetry.airTimeSeconds > 0 && (
              <span className="text-white text-[10px] sm:text-xs font-mono font-bold drop-shadow-md mt-0.5">
                AIRTIME: {telemetry.airTimeSeconds}s
              </span>
            )}
          </div>
        )}

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          <button
            id="camera-view-btn"
            onClick={onCycleCamera}
            className="bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg p-2 sm:p-2.5 transition flex items-center gap-1 text-xs font-medium shadow-lg"
            title="Switch Camera (C)"
          >
            <Camera className="w-4 h-4 text-orange-400" />
            <span className="hidden md:inline">
              {cameraView === 'first_person_helmet' ? 'Helmet' : cameraView === 'first_person_stem' ? 'Stem' : 'Chase'}
            </span>
          </button>

          <button
            id="toggle-controls-btn"
            onClick={() => setShowControls((prev) => !prev)}
            className={`bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg p-2 sm:p-2.5 transition flex items-center gap-1 text-xs font-medium shadow-lg ${
              showControls ? 'text-orange-400 border-orange-500/50' : 'text-slate-400'
            }`}
            title="Toggle On-Screen Touch Buttons"
          >
            <Gamepad2 className="w-4 h-4" />
            <span className="hidden md:inline">Controls</span>
          </button>

          <button
            id="bike-garage-btn"
            onClick={onOpenGarage}
            className="bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg p-2 sm:p-2.5 transition flex items-center gap-1 text-xs font-medium shadow-lg"
            title="Bike Garage & Customization"
          >
            <Wrench className="w-4 h-4 text-sky-400" />
            <span className="hidden md:inline">Garage</span>
          </button>

          <button
            id="reset-track-btn"
            onClick={onResetTrack}
            className="bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg p-2 sm:p-2.5 transition shadow-lg"
            title="Reset to Start (R)"
          >
            <RotateCcw className="w-4 h-4 text-slate-300" />
          </button>

          <button
            id="mute-toggle-btn"
            onClick={onToggleMute}
            className="bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg p-2 sm:p-2.5 transition shadow-lg"
            title="Toggle Sound"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            id="pause-game-btn"
            onClick={onPause}
            className="bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg p-2 sm:p-2.5 transition shadow-lg"
            title="Pause (Esc)"
          >
            <Pause className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Crash Overlay Banner */}
      {telemetry.crashState && (
        <div className="self-center bg-red-600/90 text-white font-black text-sm sm:text-lg md:text-2xl px-5 py-2 rounded-xl border border-red-400 tracking-wider shadow-2xl animate-pulse z-30">
          WIPEOUT! RECOVERING TO TRAIL...
        </div>
      )}

      {/* Bottom Instrumentation & On-Screen Touch Controls */}
      <div className="w-full flex flex-col gap-2 z-20">
        {/* Bottom Instrumentation Dashboard (Neatly positioned into the lower-left & lower-right corners) */}
        <div className="w-full flex items-end justify-between gap-2 pointer-events-none">
          {/* Left corner telemetry: Elevation & Suspension gauges */}
          <div className="flex flex-col gap-1.5 bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-xl pointer-events-auto max-w-[210px] sm:max-w-none">
            <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs font-mono">
              <div>
                <div className="text-[9px] sm:text-[10px] text-slate-400">ELEVATION</div>
                <div className="text-white font-bold text-xs sm:text-sm">{telemetry.elevation}m</div>
              </div>
              <div>
                <div className="text-[9px] sm:text-[10px] text-slate-400">DESCENT</div>
                <div className="text-emerald-400 font-bold text-xs sm:text-sm">-{telemetry.elevationDrop}m</div>
              </div>
              <div>
                <div className="text-[9px] sm:text-[10px] text-slate-400">GRADE</div>
                <div className="text-amber-400 font-bold text-xs sm:text-sm">{telemetry.gradePercentage}%</div>
              </div>
            </div>

            {/* Dual Suspension Travel Bars with mm readout and bottom-out alert */}
            <div className="flex items-center gap-2 sm:gap-3 pt-1 border-t border-slate-800/80 text-[9px] sm:text-[10px] font-mono text-slate-400">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-slate-300">FORK</span>
                <div className="w-12 sm:w-16 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative">
                  <div className="absolute left-[25%] top-0 bottom-0 w-[1px] bg-slate-500/60 z-10" title="Sag reference" />
                  <div
                    className={`h-full transition-all duration-75 ${
                      telemetry.frontForkTravelPercent > 0.92
                        ? 'bg-rose-500 animate-pulse'
                        : telemetry.frontForkTravelPercent > 0.70
                        ? 'bg-amber-400'
                        : 'bg-orange-400'
                    }`}
                    style={{ width: `${Math.round(telemetry.frontForkTravelPercent * 100)}%` }}
                  />
                </div>
                <span className="text-[8px] sm:text-[9px] text-slate-400">
                  {Math.round(telemetry.frontForkTravelPercent * 200)}mm
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-slate-300">SHOCK</span>
                <div className="w-12 sm:w-16 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative">
                  <div className="absolute left-[30%] top-0 bottom-0 w-[1px] bg-slate-500/60 z-10" title="Sag reference" />
                  <div
                    className={`h-full transition-all duration-75 ${
                      telemetry.rearShockTravelPercent > 0.92
                        ? 'bg-rose-500 animate-pulse'
                        : telemetry.rearShockTravelPercent > 0.70
                        ? 'bg-cyan-300'
                        : 'bg-sky-400'
                    }`}
                    style={{ width: `${Math.round(telemetry.rearShockTravelPercent * 100)}%` }}
                  />
                </div>
                <span className="text-[8px] sm:text-[9px] text-slate-400">
                  {Math.round(telemetry.rearShockTravelPercent * 65)}mm
                </span>
              </div>
              <div className="text-slate-300 font-semibold">{telemetry.gForce}G</div>
            </div>

            {/* Realism HUD: Dual Brake Pressures, Surface Type, and Drift / Traction */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[8px] sm:text-[9px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">BRK F/R:</span>
                <div className="flex items-center gap-1">
                  {/* Front brake pressure indicator */}
                  <div className="w-7 h-1.5 bg-slate-800 rounded overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-rose-500 transition-all duration-75"
                      style={{ width: `${Math.round((telemetry.frontBrakePressure ?? 0) * 100)}%` }}
                    />
                  </div>
                  {/* Rear brake pressure indicator */}
                  <div className="w-7 h-1.5 bg-slate-800 rounded overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-amber-400 transition-all duration-75"
                      style={{ width: `${Math.round((telemetry.rearBrakePressure ?? 0) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Surface Biome indicator badge */}
              <div className="flex items-center gap-1">
                <span className="text-slate-400">TERRAIN:</span>
                <span className="px-1.5 py-0.2 bg-slate-800 text-orange-300 rounded font-bold uppercase text-[8px]">
                  {telemetry.surfaceName || 'dirt'}
                </span>
              </div>

              {/* Drift factor percentage */}
              {(telemetry.driftPercent ?? 0) > 10 && (
                <div className="text-amber-400 font-bold animate-pulse">
                  DRIFT {telemetry.driftPercent}%
                </div>
              )}
            </div>
          </div>

          {/* Center Prompt: Drop-In Prompt or Pump Ready alert */}
          {telemetry.speedKmh < 1.0 && telemetry.distanceCoveredMeters < 5 ? (
            <div className="hidden sm:block bg-orange-500 text-slate-950 font-black text-xs px-4 py-1.5 rounded-xl shadow-2xl animate-pulse pointer-events-none uppercase tracking-wider text-center border border-orange-300">
              Hold PEDAL To Drop In!
            </div>
          ) : telemetry.pumpReady ? (
            <div className="hidden sm:block bg-emerald-500/90 text-slate-950 font-black text-[11px] px-3 py-1 rounded-lg shadow-xl animate-bounce pointer-events-none uppercase tracking-wider border border-emerald-300">
              PUMP READY (F / TAP PUMP)
            </div>
          ) : null}

          {/* Right corner telemetry: Digital Speedometer & Gear */}
          <div className="flex items-center gap-3 bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-2xl p-2.5 sm:p-3.5 shadow-2xl pointer-events-auto">
            {/* Speed Digital Readout */}
            <div className="text-right">
              <div className="font-mono text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-md leading-none">
                {Math.round(telemetry.speedKmh)}
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-orange-400 tracking-wider">KM/H</div>
            </div>

            {/* Speed Arc Bar */}
            <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-orange-500 transition-all duration-100 ease-out"
                  strokeDasharray={`${speedPercentage}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-[9px] sm:text-[10px] font-mono text-slate-300 font-bold">
                G{telemetry.gear}
              </div>
            </div>
          </div>
        </div>

        {/* On-Screen Touch & Mobile Controls: Raised and spaced safely with side padding */}
        {showControls && (
          <div className="w-full flex justify-between items-end gap-3 pt-1 pb-1 sm:pb-2 pointer-events-none">
            {/* Left: Steering D-Pad (Touch-friendly 44px+ hit targets) */}
            <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 p-1.5 sm:p-2 rounded-2xl backdrop-blur-md border border-slate-700/80 shadow-2xl">
              <button
                id="steer-left-btn"
                onPointerDown={(e) => { e.preventDefault(); onControlInput('KeyA', true); }}
                onPointerUp={(e) => { e.preventDefault(); onControlInput('KeyA', false); }}
                onPointerLeave={() => onControlInput('KeyA', false)}
                onPointerCancel={() => onControlInput('KeyA', false)}
                className="w-13 h-13 sm:w-16 sm:h-16 bg-slate-800 hover:bg-slate-700 active:bg-orange-600 active:scale-95 rounded-xl border border-slate-600 flex flex-col items-center justify-center text-white shadow-lg transition-all touch-none select-none min-w-[50px] min-h-[50px]"
                title="Steer Left (A / Left Arrow)"
              >
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-slate-300">LEFT</span>
              </button>
              <button
                id="steer-right-btn"
                onPointerDown={(e) => { e.preventDefault(); onControlInput('KeyD', true); }}
                onPointerUp={(e) => { e.preventDefault(); onControlInput('KeyD', false); }}
                onPointerLeave={() => onControlInput('KeyD', false)}
                onPointerCancel={() => onControlInput('KeyD', false)}
                className="w-13 h-13 sm:w-16 sm:h-16 bg-slate-800 hover:bg-slate-700 active:bg-orange-600 active:scale-95 rounded-xl border border-slate-600 flex flex-col items-center justify-center text-white shadow-lg transition-all touch-none select-none min-w-[50px] min-h-[50px]"
                title="Steer Right (D / Right Arrow)"
              >
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-slate-300">RIGHT</span>
              </button>
            </div>

            {/* Mobile inline drop-in hint */}
            {telemetry.speedKmh < 1.0 && telemetry.distanceCoveredMeters < 5 && (
              <div className="block sm:hidden bg-orange-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-lg shadow-xl animate-pulse pointer-events-none uppercase tracking-wider text-center">
                Press PEDAL!
              </div>
            )}

            {/* Right: Action Buttons (Pump, Hop, Front Brake, Rear Brake, Pedal) with safe spacing */}
            <div className="flex items-center gap-1 sm:gap-2 pointer-events-auto bg-slate-900/90 p-1 sm:p-2 rounded-2xl backdrop-blur-md border border-slate-700/80 shadow-2xl">
              {/* Pump Button */}
              <button
                id="pump-btn"
                onPointerDown={(e) => { e.preventDefault(); onControlInput('KeyF', true); }}
                onPointerUp={(e) => { e.preventDefault(); onControlInput('KeyF', false); }}
                onPointerLeave={() => onControlInput('KeyF', false)}
                onPointerCancel={() => onControlInput('KeyF', false)}
                className={`w-11 h-13 sm:w-14 sm:h-16 rounded-xl border flex flex-col items-center justify-center shadow-lg transition-all touch-none select-none min-w-[42px] min-h-[50px] ${
                  telemetry.pumpReady
                    ? 'bg-emerald-600/90 border-emerald-400 text-white animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-400'
                }`}
                title="Pump Terrain (F)"
              >
                <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300" />
                <span className="text-[8px] sm:text-[9px] font-black tracking-wider">PUMP</span>
              </button>

              {/* Bunny Hop Button */}
              <button
                id="hop-btn"
                onPointerDown={(e) => { e.preventDefault(); onControlInput('Space', true); }}
                onPointerUp={(e) => { e.preventDefault(); onControlInput('Space', false); }}
                onPointerLeave={() => onControlInput('Space', false)}
                onPointerCancel={() => onControlInput('Space', false)}
                className="w-11 h-13 sm:w-14 sm:h-16 bg-slate-800 hover:bg-slate-700 active:bg-purple-600 active:scale-95 rounded-xl border border-slate-600 flex flex-col items-center justify-center text-white shadow-lg transition-all touch-none select-none min-w-[42px] min-h-[50px]"
                title="Bunny Hop (Spacebar)"
              >
                <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                <span className="text-[8px] sm:text-[9px] font-black tracking-wider text-purple-300">HOP</span>
              </button>

              {/* Front Brake Button */}
              <button
                id="front-brake-btn"
                onPointerDown={(e) => { e.preventDefault(); onControlInput('KeyX', true); }}
                onPointerUp={(e) => { e.preventDefault(); onControlInput('KeyX', false); }}
                onPointerLeave={() => onControlInput('KeyX', false)}
                onPointerCancel={() => onControlInput('KeyX', false)}
                className="w-11 h-13 sm:w-14 sm:h-16 bg-rose-950/80 hover:bg-rose-900 active:bg-rose-600 active:scale-95 rounded-xl border border-rose-600 flex flex-col items-center justify-center text-white shadow-lg transition-all touch-none select-none min-w-[42px] min-h-[50px]"
                title="Front Brake (X) - 70% stopping power"
              >
                <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5 text-rose-300" />
                <span className="text-[8px] sm:text-[9px] font-black tracking-wider text-rose-300">FRONT</span>
              </button>

              {/* Rear Brake Button */}
              <button
                id="brake-btn"
                onPointerDown={(e) => { e.preventDefault(); onControlInput('KeyS', true); }}
                onPointerUp={(e) => { e.preventDefault(); onControlInput('KeyS', false); }}
                onPointerLeave={() => onControlInput('KeyS', false)}
                onPointerCancel={() => onControlInput('KeyS', false)}
                className="w-12 h-13 sm:w-15 sm:h-16 bg-amber-950/90 hover:bg-amber-900 active:bg-amber-600 active:scale-95 rounded-xl border border-amber-700 flex flex-col items-center justify-center text-white shadow-lg transition-all touch-none select-none min-w-[46px] min-h-[50px]"
                title="Rear Brake / Drift (S / Down Arrow)"
              >
                <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                <span className="text-[8px] sm:text-[9px] font-black tracking-wider text-amber-200">REAR</span>
              </button>

              {/* Pedal / Accelerate Button */}
              <button
                id="pedal-btn"
                onPointerDown={(e) => { e.preventDefault(); onControlInput('KeyW', true); }}
                onPointerUp={(e) => { e.preventDefault(); onControlInput('KeyW', false); }}
                onPointerLeave={() => onControlInput('KeyW', false)}
                onPointerCancel={() => onControlInput('KeyW', false)}
                className="w-14 h-13 sm:w-18 sm:h-16 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-300 active:scale-95 rounded-xl border border-emerald-300 flex flex-col items-center justify-center text-slate-950 shadow-lg transition-all touch-none select-none min-w-[52px] min-h-[50px]"
                title="Pedal / Accelerate (W / Up Arrow)"
              >
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950 fill-slate-950" />
                <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-slate-950">PEDAL</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
