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
  Gamepad2,
  AlertTriangle
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
  const [isTouchDevice, setIsTouchDevice] = React.useState<boolean>(() => {
    return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  });

  React.useEffect(() => {
    const handleTouch = () => setIsTouchDevice(true);
    window.addEventListener('touchstart', handleTouch, { once: true, passive: true });
    return () => window.removeEventListener('touchstart', handleTouch);
  }, []);

  const [showControls, setShowControls] = React.useState<boolean>(true);
  const [isTelemetryExpanded, setIsTelemetryExpanded] = React.useState<boolean>(false);
  const speedPercentage = Math.min(100, (telemetry.speedKmh / 75) * 100);
  const isHighSpeed = telemetry.speedKmh > 36;
  const speedIntensity = Math.min(1.0, Math.max(0, (telemetry.speedKmh - 36) / 38));

  // Dynamic G-force intensity calculation:
  // Starts scaling above 1.15G up to 2.8G+ during berm cornering, heavy compressions, or violent landings
  const gForceValue = telemetry.gForce || 1.0;
  const gIntensity = Math.max(0, Math.min(1.0, (gForceValue - 1.15) / 1.65));
  const isHighG = gIntensity > 0.05;

  // Lateral cornering bias based on bike lean angle
  const leanDeg = telemetry.leanAngleDeg || 0;
  const isLeaningLeft = leanDeg < -6;
  const isLeaningRight = leanDeg > 6;
  const leanRatio = Math.min(1.0, Math.abs(leanDeg) / 35);

  // Terrain slope calculation (incline / decline relative to bike heading)
  const isDownhill = telemetry.gradePercentage > 2;
  const isUphill = telemetry.gradePercentage < -2;
  const isFlat = !isDownhill && !isUphill;
  const slopeAngleDeg = Math.max(-45, Math.min(45, Math.round(Math.atan(telemetry.gradePercentage / 100) * (180 / Math.PI))));

  let slopeColor = '#38bdf8'; // sky-400
  let slopeLabel = 'LEVEL';
  if (isDownhill) {
    if (telemetry.gradePercentage > 35) {
      slopeColor = '#f43f5e'; // rose-500 extreme chute
      slopeLabel = 'STEEP CHUTE';
    } else if (telemetry.gradePercentage > 20) {
      slopeColor = '#f97316'; // orange-500 steep descent
      slopeLabel = 'STEEP SLOPE';
    } else {
      slopeColor = '#10b981'; // emerald-500 flow descent
      slopeLabel = 'DOWNHILL';
    }
  } else if (isUphill) {
    slopeColor = '#ec4899'; // pink-500 climb
    slopeLabel = 'UPHILL CLIMB';
  }

  // Dynamic shake offset in pixels based on G-force intensity
  const shakePx = isHighG ? (gIntensity * 5.0) : 0;

  return (
    <div 
      className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-3 sm:p-5 md:p-6 overflow-hidden"
      style={isHighG ? {
        animation: `gForceShake ${Math.max(0.04, 0.09 - gIntensity * 0.04)}s infinite alternate ease-in-out`
      } : undefined}
    >
      <style>{`
        @keyframes gForceShake {
          0% { transform: translate(0px, 0px); }
          25% { transform: translate(${(-shakePx * 0.8).toFixed(1)}px, ${(shakePx * 0.6).toFixed(1)}px); }
          50% { transform: translate(${(shakePx * 0.7).toFixed(1)}px, ${(-shakePx * 0.5).toFixed(1)}px); }
          75% { transform: translate(${(-shakePx * 0.5).toFixed(1)}px, ${(-shakePx * 0.7).toFixed(1)}px); }
          100% { transform: translate(${(shakePx * 0.8).toFixed(1)}px, ${(shakePx * 0.4).toFixed(1)}px); }
        }
      `}</style>

      {/* High-Velocity Speed Tunnel & Linear Streak FX */}
      {isHighSpeed && (
        <div 
          className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-150"
          style={{ opacity: speedIntensity * 0.85 }}
        >
          {/* Radial wind tunnel vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(15,23,42,0.65)_95%)]" />
          {/* High speed motion streaks */}
          <svg className="w-full h-full opacity-60 mix-blend-screen" xmlns="http://www.w3.org/2000/svg">
            <line x1="0%" y1="0%" x2="35%" y2="35%" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeDasharray="30 80" />
            <line x1="100%" y1="0%" x2="65%" y2="35%" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeDasharray="30 80" />
            <line x1="0%" y1="100%" x2="35%" y2="65%" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeDasharray="30 80" />
            <line x1="100%" y1="100%" x2="65%" y2="65%" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeDasharray="30 80" />
            <line x1="10%" y1="0%" x2="40%" y2="38%" stroke="rgba(251,146,60,0.35)" strokeWidth="1.5" strokeDasharray="20 60" />
            <line x1="90%" y1="0%" x2="60%" y2="38%" stroke="rgba(251,146,60,0.35)" strokeWidth="1.5" strokeDasharray="20 60" />
            <line x1="0%" y1="50%" x2="30%" y2="50%" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="40 70" />
            <line x1="100%" y1="50%" x2="70%" y2="50%" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="40 70" />
          </svg>
        </div>
      )}

      {/* Dynamic G-Force Tunnel Vision & Compression Vignette */}
      {isHighG && (
        <div 
          className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-75"
          style={{ 
            opacity: Math.min(1.0, gIntensity * 1.15),
          }}
        >
          {/* Radial compression vignette darkening peripheral vision */}
          <div 
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center, transparent ${Math.max(22, 60 - gIntensity * 38)}%, rgba(2, 6, 23, ${Math.min(0.92, 0.45 + gIntensity * 0.47)}) 98%)`,
            }}
          />

          {/* Lateral G-Force cornering pressure shade (simulates blood flow shift / centrifugal strain in sharp berm turns) */}
          {isLeaningLeft && (
            <div 
              className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-slate-950/70 to-transparent"
              style={{ opacity: gIntensity * leanRatio }}
            />
          )}
          {isLeaningRight && (
            <div 
              className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-slate-950/70 to-transparent"
              style={{ opacity: gIntensity * leanRatio }}
            />
          )}

          {/* High G-load chromatic edge ring */}
          {gIntensity > 0.45 && (
            <div 
              className="absolute inset-0 mix-blend-overlay border-8 sm:border-12 border-orange-500/25 rounded-3xl"
              style={{ opacity: (gIntensity - 0.45) * 1.8 }}
            />
          )}
        </div>
      )}

      {/* Extreme G-force / Heavy impact red blackout alert pulse */}
      {gForceValue > 2.4 && (
        <div 
          className="absolute inset-0 bg-red-600/20 mix-blend-overlay pointer-events-none z-0 animate-pulse"
          style={{ opacity: Math.min(1.0, (gForceValue - 2.4) * 1.5) }}
        />
      )}

      {/* High-speed adrenaline edge vignette (tunnels vision above 55 km/h) */}
      {telemetry.speedKmh > 55 && (
        <div
          className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-150"
          style={{
            opacity: Math.min(0.65, (telemetry.speedKmh - 55) / 35),
            background: 'radial-gradient(circle at center, transparent 62%, rgba(255,255,255,0.06) 82%, rgba(15,23,42,0.6) 100%)',
          }}
        />
      )}

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

        {/* Center: Live Split Timing & Gate Alerts in Top Header (100% Sightline Cleared!) */}
        <div className="flex-1 flex flex-col items-center justify-start pointer-events-none mx-1 sm:mx-2 max-w-sm">
          {telemetry.splitDelta && (
            <div
              className={`px-3 py-1 rounded-xl border font-mono flex items-center gap-2 backdrop-blur-md shadow-xl transition-all ${
                telemetry.splitDelta.isAhead
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 shadow-emerald-500/30'
                  : 'bg-rose-950/90 border-rose-400 text-rose-300 shadow-rose-500/30'
              }`}
            >
              <span className="text-[9px] font-black uppercase tracking-widest bg-black/40 px-1.5 py-0.5 rounded border border-white/10 text-white">
                SPLIT {telemetry.splitDelta.splitIndex}/4
              </span>
              <span className="font-black text-sm sm:text-base tracking-tight">
                {telemetry.splitDelta.isAhead ? '-' : '+'}
                {Math.abs(telemetry.splitDelta.deltaSeconds).toFixed(2)}s
              </span>
              <span className="text-[8px] font-sans font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-black/30">
                {telemetry.splitDelta.isAhead ? 'AHEAD' : 'BEHIND'}
              </span>
            </div>
          )}

          {telemetry.approachingGate && !telemetry.crashState && (
            <div
              className={`mt-1 px-3 py-1 rounded-xl border font-mono flex items-center gap-2 backdrop-blur-md shadow-xl ${
                telemetry.approachingGate.isAligned
                  ? 'bg-amber-950/90 border-amber-400 text-amber-200 shadow-amber-500/30'
                  : 'bg-red-950/90 border-red-500 text-red-200 shadow-red-500/40 animate-pulse'
              }`}
            >
              <span className="text-amber-400 text-xs font-black">⚡</span>
              <span className="text-[10px] font-black tracking-wider uppercase">
                {telemetry.approachingGate.isFinish ? 'FINISH' : `SPLIT ${telemetry.approachingGate.gateNumber}`} {telemetry.approachingGate.distanceToGate}M
              </span>
              <div className="relative w-16 h-2 bg-black/60 rounded-full border border-slate-700/80 overflow-hidden flex items-center">
                <div className="absolute inset-y-0 left-1 right-1 bg-emerald-500/20" />
                <div
                  className={`absolute w-2 h-2 rounded-full border transform -translate-x-1/2 ${
                    telemetry.approachingGate.isAligned ? 'bg-emerald-400 border-white' : 'bg-red-500 border-white'
                  }`}
                  style={{
                    left: `${Math.max(8, Math.min(92, 50 + (telemetry.approachingGate.lateralOffset / telemetry.approachingGate.gateHalfWidth) * 50))}%`,
                  }}
                />
              </div>
              <span className={`text-[8px] font-sans font-black ${telemetry.approachingGate.isAligned ? 'text-emerald-400' : 'text-red-400'}`}>
                {telemetry.approachingGate.isAligned ? 'ON-LINE' : 'CLIP!'}
              </span>
            </div>
          )}

          {telemetry.stuntName && !telemetry.splitDelta && (
            <div className="bg-orange-500 text-black font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1.5 mt-0.5">
              <Zap className="w-3.5 h-3.5 fill-black" /> {telemetry.stuntName}
            </div>
          )}
        </div>

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

      {/* Off-Track Edge Vignetting & Buffer Warning */}
      {telemetry.isOffTrack && !telemetry.crashState && (
        <>
          <div className="fixed inset-0 pointer-events-none z-30 shadow-[inset_0_0_120px_rgba(225,29,72,0.55)] border-4 border-rose-500/40 animate-pulse transition-opacity duration-150" />
          <div className="self-center bg-rose-600/95 text-white font-black text-xs sm:text-base md:text-xl px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl border-2 border-rose-300 tracking-wider shadow-2xl animate-pulse z-40 flex items-center gap-2 pointer-events-none">
            <AlertTriangle className="w-5 h-5 text-amber-300 animate-bounce" />
            <span>OFF TRACK — RESPAWNING IN {(Math.max(0, 1.5 - (telemetry.offTrackSeconds || 0))).toFixed(1)}s</span>
          </div>
        </>
      )}

      {/* Quick Fade-to-Black Overlay on Respawn */}
      {telemetry.isRespawning && (
        <div className="fixed inset-0 bg-black z-50 pointer-events-none transition-opacity duration-150 animate-pulse" />
      )}

      {/* Bottom Instrumentation & On-Screen Touch Controls */}
      <div className="w-full flex flex-col gap-1.5 sm:gap-2 z-20">
        {/* Bottom Instrumentation Dashboard (Neatly positioned into the lower-left & lower-right corners) */}
        <div className="w-full flex items-end justify-between gap-2 pointer-events-none">
          {/* Left corner telemetry: Streamlined with dual vertical suspension progress bars */}
          <div className="flex flex-col gap-1 sm:gap-1.5 bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-xl p-2 sm:p-2.5 md:p-3 shadow-xl pointer-events-auto max-w-[280px] sm:max-w-sm">
            <div className="flex items-center justify-between gap-3 text-[10px] sm:text-xs font-mono">
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Elevation Drop */}
                <div>
                  <div className="text-[8px] sm:text-[9px] text-slate-400">DROP</div>
                  <div className="text-emerald-400 font-bold text-xs sm:text-sm">-{telemetry.elevationDrop}m</div>
                </div>

                {/* Lateral / Dynamic G-Force */}
                <div>
                  <div className="text-[8px] sm:text-[9px] text-slate-400">G-FORCE</div>
                  <div className="text-slate-200 font-bold text-xs sm:text-sm">{telemetry.gForce}G</div>
                </div>

                {/* Side-by-side Vertical Suspension Progress Bars (Fork & Shock) */}
                <div className="flex items-center gap-1.5 pl-1 border-l border-slate-800">
                  {/* Fork Travel Progress Bar */}
                  <div className="flex flex-col items-center gap-0.5" title={`Fork Travel: ${Math.round(telemetry.frontForkTravelPercent * 100)}%`}>
                    <div className="w-2.5 h-8 bg-slate-950 rounded-full overflow-hidden border border-slate-700/80 relative flex items-end">
                      <div
                        className="w-full bg-orange-400 rounded-full transition-all duration-75"
                        style={{ height: `${Math.round(telemetry.frontForkTravelPercent * 100)}%` }}
                      />
                    </div>
                    <span className="text-[7.5px] font-bold text-orange-400">F</span>
                  </div>

                  {/* Shock Travel Progress Bar */}
                  <div className="flex flex-col items-center gap-0.5" title={`Shock Travel: ${Math.round(telemetry.rearShockTravelPercent * 100)}%`}>
                    <div className="w-2.5 h-8 bg-slate-950 rounded-full overflow-hidden border border-slate-700/80 relative flex items-end">
                      <div
                        className="w-full bg-sky-400 rounded-full transition-all duration-75"
                        style={{ height: `${Math.round(telemetry.rearShockTravelPercent * 100)}%` }}
                      />
                    </div>
                    <span className="text-[7.5px] font-bold text-sky-400">S</span>
                  </div>
                </div>
              </div>

              {/* Compact / Detail Telemetry Toggle */}
              <button
                onClick={() => setIsTelemetryExpanded((prev) => !prev)}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[8.5px] font-bold transition"
                title={isTelemetryExpanded ? 'Collapse Telemetry' : 'Expand Clinometer & Brake Telemetry'}
              >
                {isTelemetryExpanded ? '▲ LESS' : '▼ MORE'}
              </button>
            </div>

            {/* Expandable Technical Telemetry Section */}
            {isTelemetryExpanded && (
              <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-slate-800/80 animate-in fade-in duration-150">
                {/* Dynamic Incline / Decline Slope Clinometer Gauge */}
                <div className="flex items-center gap-2">
                  <div
                    className="relative w-7 h-7 rounded-lg bg-slate-950/80 border border-slate-700/80 flex items-center justify-center overflow-hidden shadow-inner"
                    title={`Slope: ${slopeLabel}`}
                  >
                    <div className="absolute w-full h-[1px] bg-slate-600/40 border-t border-dashed border-slate-500/30" />
                    <div className="absolute h-full w-[1px] bg-slate-600/25" />
                    <div
                      className="absolute w-8 h-[2px] rounded-full transition-transform duration-150 ease-out shadow-sm"
                      style={{
                        transform: `rotate(${-slopeAngleDeg}deg)`,
                        backgroundColor: slopeColor,
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1 leading-none text-[9px] font-mono">
                    <span className="font-bold" style={{ color: slopeColor }}>
                      {slopeLabel}
                    </span>
                    <span className="text-slate-400">
                      {isUphill ? '▲ UP' : isFlat ? '—' : '▼ DN'}
                    </span>
                  </div>
                </div>

                {/* Minimal Brake Pressures */}
                <div className="flex items-center gap-2 text-[8px] font-mono border-l border-slate-800 pl-2">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">FB</span>
                    <div className="w-5 h-1.5 bg-slate-950 rounded overflow-hidden border border-slate-700">
                      <div
                        className="h-full bg-rose-500 transition-all duration-75"
                        style={{ width: `${Math.round((telemetry.frontBrakePressure ?? 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">RB</span>
                    <div className="w-5 h-1.5 bg-slate-950 rounded overflow-hidden border border-slate-700">
                      <div
                        className="h-full bg-amber-400 transition-all duration-75"
                        style={{ width: `${Math.round((telemetry.rearBrakePressure ?? 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right corner telemetry: Digital Speedometer & Gear */}
          {cameraView !== 'first_person_stem' && (
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
          )}
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
              {/* Pump Button with intuitive glow ring */}
              <button
                id="pump-btn"
                onPointerDown={(e) => { e.preventDefault(); onControlInput('KeyF', true); }}
                onPointerUp={(e) => { e.preventDefault(); onControlInput('KeyF', false); }}
                onPointerLeave={() => onControlInput('KeyF', false)}
                onPointerCancel={() => onControlInput('KeyF', false)}
                className={`relative w-11 h-13 sm:w-14 sm:h-16 rounded-xl border flex flex-col items-center justify-center shadow-lg transition-all touch-none select-none min-w-[42px] min-h-[50px] ${
                  telemetry.pumpReady
                    ? 'bg-emerald-600/95 border-emerald-300 text-white ring-4 ring-emerald-400/80 shadow-emerald-400/70 shadow-lg animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-400'
                }`}
                title="Pump Terrain (F)"
              >
                {telemetry.pumpReady && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white animate-ping" />
                )}
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
