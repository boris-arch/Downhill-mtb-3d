import React from 'react';
import { Play, RotateCcw, Wrench, Mountain, X, Keyboard } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onOpenGarage: () => void;
  onOpenTracks: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onOpenGarage,
  onOpenTracks,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 md:p-8 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-white uppercase tracking-wide">Trail Paused</h2>
          </div>
          <button
            onClick={onResume}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Reference Card */}
        <div className="bg-slate-950/60 rounded-2xl border border-slate-800 p-4 mb-6">
          <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider mb-3">
            <Keyboard className="w-4 h-4" /> Downhill Cockpit Controls
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-mono">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Pedal / Pump:</span>
              <kbd className="bg-slate-800 px-2 py-0.5 rounded text-white font-bold">W / ↑</kbd>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Hydraulic Brakes:</span>
              <kbd className="bg-slate-800 px-2 py-0.5 rounded text-white font-bold">S / ↓</kbd>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Steer / Berm Lean:</span>
              <kbd className="bg-slate-800 px-2 py-0.5 rounded text-white font-bold">A / D or ← / →</kbd>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Bunny Hop / Pop:</span>
              <kbd className="bg-slate-800 px-2 py-0.5 rounded text-white font-bold">Space</kbd>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Speed Tuck (Aero):</span>
              <kbd className="bg-slate-800 px-2 py-0.5 rounded text-white font-bold">Shift</kbd>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Air Whips / Style:</span>
              <kbd className="bg-slate-800 px-2 py-0.5 rounded text-white font-bold">Q / E</kbd>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Cycle Camera:</span>
              <kbd className="bg-slate-800 px-2 py-0.5 rounded text-white font-bold">C</kbd>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">Quick Reset:</span>
              <kbd className="bg-slate-800 px-2 py-0.5 rounded text-white font-bold">R</kbd>
            </div>
          </div>
        </div>

        {/* Action Menu */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onResume}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-slate-950" /> Resume Ride
          </button>
          <button
            onClick={onRestart}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Restart From Mountain Top
          </button>
          <div className="flex gap-2.5">
            <button
              onClick={onOpenGarage}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2"
            >
              <Wrench className="w-4 h-4 text-sky-400" /> Bike Garage
            </button>
            <button
              onClick={onOpenTracks}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2"
            >
              <Mountain className="w-4 h-4 text-orange-400" /> Select Trail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
