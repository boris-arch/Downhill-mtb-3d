import React from 'react';
import { TrackData } from '../types/game';
import { TRACKS } from '../data/tracks';
import { Mountain, Compass, Timer, ArrowDownRight, X, Play } from 'lucide-react';

interface TrackSelectModalProps {
  currentTrackId: string;
  onSelectTrack: (track: TrackData) => void;
  onClose: () => void;
}

export const TrackSelectModal: React.FC<TrackSelectModalProps> = ({
  currentTrackId,
  onSelectTrack,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/10 border border-orange-500/30 rounded-xl">
              <Mountain className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">Trail Head Selector</h2>
              <p className="text-xs text-slate-400">Choose your downhill descent line</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Trail Cards */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {TRACKS.map((t) => {
            const isSelected = t.id === currentTrackId;
            return (
              <div
                key={t.id}
                onClick={() => {
                  onSelectTrack(t);
                  onClose();
                }}
                className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                  isSelected
                    ? 'border-orange-500 bg-orange-500/10 shadow-lg'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div>
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-3 ${
                      t.difficulty.includes('Blue')
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        : t.difficulty.includes('Black')
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {t.difficulty}
                  </span>
                  <h3 className="text-base font-black text-white mb-1">{t.name}</h3>
                  <p className="text-xs text-slate-400 mb-4 line-clamp-2">{t.description}</p>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Compass className="w-3.5 h-3.5" /> Length
                    </span>
                    <span>{t.lengthMeters}m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-400">
                      <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" /> Vertical Drop
                    </span>
                    <span className="text-emerald-400">-{t.elevationDropMeters}m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Timer className="w-3.5 h-3.5" /> Course Par
                    </span>
                    <span>{t.recordTime}s</span>
                  </div>
                </div>

                <button
                  className={`mt-4 w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-orange-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" /> {isSelected ? 'Current Trail' : 'Ride Trail'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
