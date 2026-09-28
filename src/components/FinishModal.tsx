import React, { useState, useEffect } from 'react';
import { TelemetryData, TrackData } from '../types/game';
import confetti from 'canvas-confetti';
import { Trophy, Timer, Zap, ArrowDownRight, RotateCcw, Mountain, Wrench, Medal, Flame } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface FinishModalProps {
  telemetry: TelemetryData;
  track: TrackData;
  onRestart: () => void;
  onChangeTrack: () => void;
  onOpenGarage: () => void;
}

export const FinishModal: React.FC<FinishModalProps> = ({
  telemetry,
  track,
  onRestart,
  onChangeTrack,
  onOpenGarage,
}) => {
  const storageKey = `mtb_pb_${track.id}`;
  const [personalBest, setPersonalBest] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? parseFloat(saved) : null;
    } catch {
      return null;
    }
  });
  const [isNewRecord, setIsNewRecord] = useState(false);

  useEffect(() => {
    soundEngine.playAirHorn();
    try {
      const prev = personalBest;
      if (prev === null || telemetry.elapsedTime < prev) {
        setIsNewRecord(true);
        localStorage.setItem(storageKey, telemetry.elapsedTime.toString());
        setPersonalBest(telemetry.elapsedTime);
      }
    } catch {
      // Ignore
    }
    // Launch celebratory confetti
    try {
      confetti({
        particleCount: 110,
        spread: 85,
        origin: { y: 0.55 },
      });
    } catch {
      // Ignore
    }
  }, []);

  const isGold = telemetry.elapsedTime <= track.recordTime;
  const isSilver = !isGold && telemetry.elapsedTime <= track.recordTime * 1.25;
  const isBronze = !isGold && !isSilver;

  const medalName = isGold ? 'GOLD MEDAL' : isSilver ? 'SILVER MEDAL' : 'BRONZE MEDAL';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 md:p-8 flex flex-col items-center text-center relative">
        {/* New Course Record Banner */}
        {isNewRecord && (
          <div className="mb-3 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/30 to-amber-500/20 border border-amber-400/60 text-amber-300 font-mono font-black text-xs uppercase tracking-widest flex items-center gap-1.5 shadow-lg animate-pulse">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            NEW PERSONAL RECORD!
          </div>
        )}

        {/* Medal Badge */}
        <div className={`p-4 rounded-2xl mb-3 shadow-xl border ${
          isGold
            ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
            : isSilver
            ? 'bg-slate-400/20 border-slate-400/40 text-slate-300'
            : 'bg-amber-700/20 border-amber-700/40 text-amber-500'
        }`}>
          <Trophy className="w-12 h-12" />
        </div>

        <div className="text-[11px] font-mono font-black tracking-widest uppercase mb-1 text-slate-400 flex items-center gap-1.5">
          <Medal className="w-3.5 h-3.5 text-amber-400" />
          {medalName}
        </div>

        <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wide">
          Descent Completed!
        </h2>
        <p className="text-xs text-slate-400 mt-1 mb-5">
          {track.name} &bull; {track.difficulty}
        </p>

        {/* Medal Criteria Milestones */}
        <div className="w-full flex items-center justify-between bg-slate-950/70 border border-slate-800/80 rounded-xl px-4 py-2 mb-4 font-mono text-[10px] text-slate-400">
          <div className={`flex flex-col items-center ${isGold ? 'text-amber-400 font-bold' : ''}`}>
            <span>🥇 Gold</span>
            <span>≤ {track.recordTime}s</span>
          </div>
          <div className="h-6 w-[1px] bg-slate-800" />
          <div className={`flex flex-col items-center ${isSilver ? 'text-slate-300 font-bold' : ''}`}>
            <span>🥈 Silver</span>
            <span>≤ {Math.round(track.recordTime * 1.25)}s</span>
          </div>
          <div className="h-6 w-[1px] bg-slate-800" />
          <div className={`flex flex-col items-center ${isBronze ? 'text-amber-500 font-bold' : ''}`}>
            <span>🥉 Bronze</span>
            <span>&gt; {Math.round(track.recordTime * 1.25)}s</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="w-full grid grid-cols-2 gap-3 mb-6 font-mono text-left">
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1 mb-1">
              <Timer className="w-3 h-3 text-orange-400" /> Run Time
            </div>
            <div className="text-xl font-bold text-white">
              {Math.floor(telemetry.elapsedTime / 60)}:
              {String(Math.floor(telemetry.elapsedTime % 60)).padStart(2, '0')}.
              {String(Math.floor((telemetry.elapsedTime % 1) * 100)).padStart(2, '0')}
            </div>
            <div className="text-[10px] text-slate-500">
              Best: {personalBest ? `${personalBest.toFixed(2)}s` : `${track.recordTime}s`}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1 mb-1">
              <Zap className="w-3 h-3 text-sky-400" /> Stunt Score
            </div>
            <div className="text-xl font-bold text-white">{telemetry.score}</div>
            <div className="text-[10px] text-slate-500">{telemetry.jumpCount} Jumps Sent</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1 mb-1">
              <ArrowDownRight className="w-3 h-3 text-emerald-400" /> Total Drop
            </div>
            <div className="text-xl font-bold text-emerald-400">-{track.elevationDropMeters}m</div>
            <div className="text-[10px] text-slate-500">{track.lengthMeters}m Traversed</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1 mb-1">
              <Zap className="w-3 h-3 text-amber-400" /> Top Speed
            </div>
            <div className="text-xl font-bold text-amber-400">{Math.round(telemetry.speedKmh)} km/h</div>
            <div className="text-[10px] text-slate-500">Peak G-Force: {telemetry.gForce}G</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={onRestart}
            className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Drop In Again
          </button>
          <button
            onClick={onChangeTrack}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Mountain className="w-4 h-4 text-orange-400" /> Switch Trail
          </button>
          <button
            onClick={onOpenGarage}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center cursor-pointer"
            title="Tune Bike"
          >
            <Wrench className="w-4 h-4 text-sky-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
