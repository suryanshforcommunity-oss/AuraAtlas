import React from 'react';
import { SimulationState } from '../types/fleet';
import { Gauge, Clock, RefreshCw, CheckCheck, TrendingUp, AlertTriangle } from 'lucide-react';

interface PerformancePanelProps {
  state: SimulationState | null;
}

export const PerformancePanel: React.FC<PerformancePanelProps> = ({ state }) => {
  const perf = state?.performance;
  const metrics = state?.metrics;
  const totalRobots = state?.robots?.length || 1;
  const activeRobots = metrics?.active || 0;

  const fleetEfficiency = Math.min(
    100,
    Math.round((activeRobots / Math.max(1, totalRobots - (metrics?.failed || 0))) * 100)
  );

  return (
    <div className="space-y-3 text-xs">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span>Tasks / 100 Ticks</span>
          </div>
          <div className="text-base font-bold font-mono text-emerald-400">
            {perf?.throughput_100 ?? 0}
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
            <Clock className="w-3 h-3 text-indigo-400" />
            <span>Avg Delivery</span>
          </div>
          <div className="text-base font-bold font-mono text-indigo-300">
            {perf?.avg_delivery ?? 0} <span className="text-[10px] font-normal text-slate-400">ticks</span>
          </div>
        </div>
      </div>

      {/* Detail Rows */}
      <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="flex justify-between py-1 border-b border-slate-800/60">
          <span className="text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Conflicts Resolved
          </span>
          <span className="font-mono font-bold text-amber-300">{perf?.conflicts ?? 0}</span>
        </div>

        <div className="flex justify-between py-1 border-b border-slate-800/60">
          <span className="text-slate-400 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" /> Route Adaptations
          </span>
          <span className="font-mono font-bold text-cyan-300">{perf?.replans ?? 0}</span>
        </div>

        <div className="flex justify-between py-1">
          <span className="text-slate-400 flex items-center gap-1.5">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> Total Deliveries
          </span>
          <span className="font-mono font-bold text-emerald-300">{perf?.total_deliveries ?? 0}</span>
        </div>
      </div>

      {/* Fleet Efficiency Gauge Bar */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1.5">
          <span className="flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5 text-indigo-400" /> Swarm Fleet Efficiency
          </span>
          <span className="font-mono text-indigo-300">{fleetEfficiency}%</span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${fleetEfficiency}%` }}
          />
        </div>
      </div>
    </div>
  );
};
