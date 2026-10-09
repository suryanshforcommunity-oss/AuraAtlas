import React from 'react';
import { StationData } from '../types/fleet';
import { MapPin, Plus, RefreshCw } from 'lucide-react';

interface StationPanelProps {
  stations: StationData[];
  onSetPriority: (sid: number, priority: number) => void;
  onRefillStation?: (sid: number, qty: number, priority?: number) => void;
}

export const StationPanel: React.FC<StationPanelProps> = ({ stations, onSetPriority, onRefillStation }) => {
  if (!stations || stations.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-500 italic">
        No active stations mapped
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-indigo-400" />
          <span>Pickup Priority & Real-Time Refills:</span>
        </span>
      </div>

      {stations.map(s => {
        const isPick = s.type === 'pick';
        const barColor = isPick ? 'bg-emerald-500' : 'bg-orange-500';

        return (
          <div
            key={s.id}
            className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
          >
            {/* Station Identifier */}
            <div className="w-20 font-mono text-[11px] font-semibold text-slate-300 shrink-0">
              <span className={isPick ? 'text-emerald-400 font-bold' : 'text-orange-400 font-bold'}>
                {isPick ? 'Pick' : 'Drop'}
              </span>{' '}
              ({s.x},{s.y})
            </div>

            {/* Inventory Fill Meter */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Stock</span>
                <span className="font-mono font-semibold text-slate-200">
                  {s.current} / {s.max}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${s.pct}%` }}
                />
              </div>
            </div>

            {/* Real-time Refill & Priority Controls (for pick stations) */}
            {isPick && (
              <div className="flex items-center gap-1.5 shrink-0">
                {onRefillStation && (
                  <button
                    onClick={() => onRefillStation(s.id, 4, s.priority)}
                    className="p-1 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-0.5 transition-all"
                    title="Add +4 Priority Stock in Real-Time"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+4</span>
                  </button>
                )}

                <div className="flex items-center gap-0.5">
                  {[1, 2, 3].map(pri => {
                    const isActive = s.priority === pri;
                    const priColor =
                      pri === 3
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : pri === 2
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

                    return (
                      <button
                        key={pri}
                        onClick={() => onSetPriority(s.id, pri)}
                        className={`w-5 h-5 rounded font-mono font-bold text-[9px] border transition-all ${
                          isActive
                            ? `${priColor} shadow-sm font-black ring-1 ring-white/20`
                            : 'bg-slate-800/80 border-slate-700/80 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        P{pri}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
