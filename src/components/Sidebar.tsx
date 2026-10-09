import React, { useState } from 'react';
import { SimulationState } from '../types/fleet';
import { TaskPanel } from './TaskPanel';
import { StationPanel } from './StationPanel';
import { ConflictPanel } from './ConflictPanel';
import { HiveFeed } from './HiveFeed';
import { PerformancePanel } from './PerformancePanel';
import {
  ChevronRight,
  Cpu,
  MapPin,
  ShieldAlert,
  Radio,
  BarChart3,
  ListTodo,
  Layers,
  ChevronDown
} from 'lucide-react';

interface SidebarProps {
  state: SimulationState | null;
  onSetStationPriority: (sid: number, priority: number) => void;
  onFailRobot: (rid: number) => void;
  onRefillStation?: (sid: number, qty: number, priority?: number) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  state,
  onSetStationPriority,
  onFailRobot,
  onRefillStation,
}) => {
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
    metrics: true,
    tasks: true,
    stations: true,
    conflicts: true,
    hive: true,
    perf: true,
  });

  const togglePanel = (key: string) => {
    setOpenPanels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const metrics = state?.metrics;

  return (
    <aside className="w-80 md:w-96 bg-[#0b0f19]/95 border-l border-slate-800/80 flex flex-col h-full overflow-y-auto z-20 shadow-2xl backdrop-blur-lg select-none">
      {/* Overview Stat Strip */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/50">
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-medium">Tick</div>
            <div className="text-sm font-bold font-mono text-indigo-400">
              {state?.tick ?? 0}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-medium">Tasks</div>
            <div className="text-sm font-bold font-mono text-emerald-400">
              {metrics?.throughput ?? 0}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-medium">Active</div>
            <div className="text-sm font-bold font-mono text-cyan-400">
              {metrics?.active ?? 0}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-medium">Failed</div>
            <div className="text-sm font-bold font-mono text-rose-400">
              {metrics?.failed ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Panels */}

      {/* 1. TASK ASSIGNMENTS */}
      <div className="border-b border-slate-800/80">
        <button
          onClick={() => togglePanel('tasks')}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-indigo-400 uppercase tracking-wider hover:bg-slate-900/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Task Assignments ({state?.robots?.length || 0})
          </span>
          {openPanels.tasks ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </button>
        {openPanels.tasks && (
          <div className="px-4 pb-4 animate-fadeIn">
            <TaskPanel robots={state?.robots || []} onFailRobot={onFailRobot} />
          </div>
        )}
      </div>

      {/* 2. STATIONS */}
      <div className="border-b border-slate-800/80">
        <button
          onClick={() => togglePanel('stations')}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-emerald-400 uppercase tracking-wider hover:bg-slate-900/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            Station Inventories & Priorities
          </span>
          {openPanels.stations ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </button>
        {openPanels.stations && (
          <div className="px-4 pb-4 animate-fadeIn">
            <StationPanel
              stations={state?.stations || []}
              onSetPriority={onSetStationPriority}
              onRefillStation={onRefillStation}
            />
          </div>
        )}
      </div>

      {/* 3. CONFLICT PREDICTIONS */}
      <div className="border-b border-slate-800/80">
        <button
          onClick={() => togglePanel('conflicts')}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-amber-400 uppercase tracking-wider hover:bg-slate-900/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Collision Predictions ({state?.conflicts?.length || 0})
          </span>
          {openPanels.conflicts ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </button>
        {openPanels.conflicts && (
          <div className="px-4 pb-4 animate-fadeIn">
            <ConflictPanel conflicts={state?.conflicts || []} />
          </div>
        )}
      </div>

      {/* 4. HIVE MIND FEED */}
      <div className="border-b border-slate-800/80">
        <button
          onClick={() => togglePanel('hive')}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-cyan-400 uppercase tracking-wider hover:bg-slate-900/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            Hive Mind Swarm Stream
          </span>
          {openPanels.hive ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </button>
        {openPanels.hive && (
          <div className="px-4 pb-4 animate-fadeIn">
            <HiveFeed messages={state?.hive_mind || []} />
          </div>
        )}
      </div>

      {/* 5. PERFORMANCE ANALYTICS */}
      <div className="border-b border-slate-800/80">
        <button
          onClick={() => togglePanel('perf')}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-purple-400 uppercase tracking-wider hover:bg-slate-900/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            Performance & Fleet Analytics
          </span>
          {openPanels.perf ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </button>
        {openPanels.perf && (
          <div className="px-4 pb-4 animate-fadeIn">
            <PerformancePanel state={state} />
          </div>
        )}
      </div>
    </aside>
  );
};
