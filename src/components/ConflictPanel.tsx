import React from 'react';
import { ConflictData } from '../types/fleet';
import { ShieldAlert, CheckCircle2, Clock } from 'lucide-react';

interface ConflictPanelProps {
  conflicts: ConflictData[];
}

export const ConflictPanel: React.FC<ConflictPanelProps> = ({ conflicts }) => {
  if (!conflicts || conflicts.length === 0) {
    return (
      <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>No swarm path collisions predicted. PIBT active.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conflicts.map((cf, idx) => {
        const isVertex = cf.type === 'vertex';
        const confidencePct = Math.round(cf.confidence * 100);

        return (
          <div
            key={idx}
            className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200"
          >
            <div className="flex items-center justify-between font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-amber-300">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Robot R{cf.robot_a} ↔ R{cf.robot_b}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {cf.type} conflict
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-amber-300/80 my-1">
              <span>Cell ({cf.cell[0]}, {cf.cell[1]})</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" /> {cf.ticks_away} ticks away
              </span>
            </div>

            {/* Confidence Bar */}
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-amber-400/70 mb-0.5">
                <span>Prediction Confidence</span>
                <span className="font-mono">{confidencePct}%</span>
              </div>
              <div className="h-1.5 w-full bg-amber-950/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
