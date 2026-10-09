import React from 'react';
import { RobotData } from '../types/fleet';
import { Package, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';

interface TaskPanelProps {
  robots: RobotData[];
  onFailRobot?: (rid: number) => void;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({ robots, onFailRobot }) => {
  if (!robots || robots.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-500 italic">
        No active robots in swarm
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {robots.map(r => {
        const phase = r.phase || 'idle';
        const isPick = phase === 'pickup';
        const isDrop = phase === 'dropoff';
        const isFailed = r.state === 'failed';
        const isWaiting = r.state === 'waiting';

        const targetTxt = r.target ? `(${r.target[0]}, ${r.target[1]})` : '—';
        const pathLen = r.path?.length || 0;
        const progressPct = r.state === 'idle' ? 0 : Math.max(10, Math.min(100, 100 - pathLen * 7));

        return (
          <div
            key={r.id}
            className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all text-xs"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: isFailed ? '#ef4444' : r.color }}
                />
                <span className="font-bold font-mono text-slate-100">Robot {r.id}</span>

                {/* Status Badges */}
                {isFailed ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    HARDWARE FAIL
                  </span>
                ) : isPick ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Package className="w-3 h-3 text-emerald-400" /> PICKING
                  </span>
                ) : isDrop ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 text-orange-400" /> DROPPING
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                    IDLE
                  </span>
                )}
              </div>

              {/* Fail Trigger Button */}
              {onFailRobot && !isFailed && (
                <button
                  onClick={() => onFailRobot(r.id)}
                  title="Simulate Robot Failure"
                  className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                >
                  Fail
                </button>
              )}
            </div>

            {/* Target, Carrying and Battery details */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 my-1">
              <span>Pos: <strong className="text-slate-200 font-mono">({r.x},{r.y})</strong></span>
              <span>Target: <strong className="text-indigo-300 font-mono">{targetTxt}</strong></span>
              <span className={`font-mono font-bold ${r.battery <= 15 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                ⚡ {r.battery !== undefined ? r.battery : 100}%
              </span>
              {r.carrying > 0 && (
                <span className="text-amber-300 font-medium flex items-center gap-1 font-mono">
                  📦 {r.carrying}/{r.capacity}
                </span>
              )}
            </div>

            {/* Progress Bar */}
            {!isFailed && r.state !== 'idle' && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Route Progress</span>
                  <span className="font-mono text-slate-400">{progressPct}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: r.color,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
