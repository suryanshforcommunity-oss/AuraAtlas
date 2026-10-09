import React from 'react';
import { HiveMessage } from '../types/fleet';
import { Radio } from 'lucide-react';

interface HiveFeedProps {
  messages: HiveMessage[];
}

export const HiveFeed: React.FC<HiveFeedProps> = ({ messages }) => {
  if (!messages || messages.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-500 italic">
        Awaiting swarm event stream...
      </div>
    );
  }

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'yield':
        return 'border-amber-500/80 bg-amber-500/10 text-amber-200';
      case 'detour':
        return 'border-cyan-500/80 bg-cyan-500/10 text-cyan-200';
      case 'pickup':
        return 'border-emerald-500/80 bg-emerald-500/10 text-emerald-200';
      case 'delivery':
        return 'border-orange-500/80 bg-orange-500/10 text-orange-200';
      case 'auction':
        return 'border-purple-500/80 bg-purple-500/10 text-purple-200';
      case 'restock':
        return 'border-teal-500/80 bg-teal-500/10 text-teal-200';
      case 'fail':
        return 'border-rose-500/80 bg-rose-500/10 text-rose-200 font-bold';
      default:
        return 'border-slate-700 bg-slate-800/60 text-slate-300';
    }
  };

  return (
    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
      {messages.map((m, i) => {
        const style = getTypeStyle(m.type);

        return (
          <div
            key={i}
            className={`p-2 rounded-lg border-l-2 text-xs flex items-center justify-between gap-2 transition-all ${style}`}
          >
            <span className="leading-snug">{m.msg}</span>
            <span className="text-[10px] font-mono uppercase opacity-70 px-1.5 py-0.5 rounded bg-slate-900/40">
              {m.type}
            </span>
          </div>
        );
      })}
    </div>
  );
};
