import React from 'react';
import {
  Home,
  Activity,
  BarChart3,
  Server,
  Flame,
  Route,
  ShieldAlert,
  Trash2,
  Layers,
  Compass,
  Zap,
  Bot,
  MapPin,
  Truck,
  BatteryCharging,
  Siren,
  Sliders,
  Cpu,
  Boxes
} from 'lucide-react';
import { SimulationState } from '../types/fleet';

interface LeftSidebarProps {
  state: SimulationState | null;
  heatOn: boolean;
  routeOn: boolean;
  blockMode: boolean;
  onToggleHeat: () => void;
  onToggleRoutes: () => void;
  onToggleBlock: () => void;
  onClearBlocks?: () => void;
  onNavigateHome?: () => void;
  onNavigateArchitecture?: () => void;
  onNavigateTelemetry?: () => void;
  onNavigateAnalytics?: () => void;
  onOpenEdgeAIModal?: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  state,
  heatOn,
  routeOn,
  blockMode,
  onToggleHeat,
  onToggleRoutes,
  onToggleBlock,
  onClearBlocks,
  onNavigateHome,
  onNavigateArchitecture,
  onNavigateTelemetry,
  onNavigateAnalytics,
  onOpenEdgeAIModal,
}) => {
  const robots = state?.robots || [];
  const activeCount = robots.filter(r => r.state === 'moving').length;
  const idleCount = robots.filter(r => r.state === 'idle' || r.state === 'waiting').length;
  const chargingCount = robots.filter(r => r.state === 'charging').length;
  const emergencyCount = robots.filter(r => r.isEmergency || (state?.emergency?.active && state.emergency.robotId === r.id)).length;

  return (
    <aside className="w-64 bg-[#0b0f19]/95 border-r border-slate-800/80 flex flex-col h-full overflow-y-auto z-20 shadow-2xl backdrop-blur-lg select-none">
      {/* 1. PORTALS & VIEWS */}
      <div className="p-3.5 border-b border-slate-800/80">
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span>Views & Analytics</span>
        </div>
        <div className="space-y-1">
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800/60 hover:border-slate-700 transition-all group"
            >
              <Home className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>Landing Page</span>
            </button>
          )}

          {onNavigateTelemetry && (
            <button
              onClick={onNavigateTelemetry}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-cyan-300 hover:text-cyan-200 bg-cyan-950/20 hover:bg-cyan-950/40 border border-cyan-500/20 hover:border-cyan-500/40 transition-all group"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>AGV Telemetry</span>
            </button>
          )}

          {onNavigateAnalytics && (
            <button
              onClick={onNavigateAnalytics}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/20 hover:border-emerald-500/40 transition-all group"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Fleet Analytics</span>
            </button>
          )}

          {onNavigateArchitecture && (
            <button
              onClick={onNavigateArchitecture}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/40 hover:bg-slate-800/80 border border-slate-800/60 hover:border-slate-700 transition-all group"
            >
              <Server className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>Architecture</span>
            </button>
          )}

          {onOpenEdgeAIModal && (
            <button
              onClick={onOpenEdgeAIModal}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-cyan-300 hover:text-cyan-200 bg-cyan-950/30 hover:bg-cyan-950/50 border border-cyan-500/40 hover:border-cyan-500/60 transition-all group shadow-md shadow-cyan-950/40"
              title="Open Interactive 3D Warehouse Digital Twin & AURA EdgeAI"
            >
              <div className="flex items-center gap-2.5">
                <Boxes className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>AURA EdgeAI 3D</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                3D
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MAP OVERLAYS & TOOLS */}
      <div className="p-3.5 border-b border-slate-800/80">
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Map Layers & Tools</span>
        </div>
        <div className="space-y-1.5">
          {/* Heatmap Toggle */}
          <button
            onClick={onToggleHeat}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              heatOn
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-md shadow-rose-950/40'
                : 'bg-slate-900/50 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Heatmap Layer</span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                heatOn ? 'bg-rose-500/30 text-rose-300' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {heatOn ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Routes Toggle */}
          <button
            onClick={onToggleRoutes}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              routeOn
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-md shadow-indigo-950/40'
                : 'bg-slate-900/50 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Route className="w-3.5 h-3.5 text-indigo-400" />
              <span>AGV Routes</span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                routeOn ? 'bg-indigo-500/30 text-indigo-300' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {routeOn ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Block Obstacle Mode Toggle */}
          <button
            onClick={onToggleBlock}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              blockMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-950/40 animate-pulse'
                : 'bg-slate-900/50 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Block Obstacle</span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                blockMode ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {blockMode ? 'ACTIVE' : 'IDLE'}
            </span>
          </button>

          {/* Clear Blocks Button */}
          {onClearBlocks && (
            <button
              onClick={onClearBlocks}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear Obstacles</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. WAREHOUSE MAP LEGEND */}
      <div className="p-3.5 border-b border-slate-800/80">
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span>Warehouse Legend</span>
        </div>
        <div className="space-y-2 text-[11px] font-mono">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/70">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
              <span className="text-slate-300">Pick Station</span>
            </div>
            <span className="text-slate-500 text-[10px]">{state?.grid?.pick_stations?.length || 0}</span>
          </div>

          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/70">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-orange-500 shadow-sm shadow-orange-500/50"></span>
              <span className="text-slate-300">Drop Dock</span>
            </div>
            <span className="text-slate-500 text-[10px]">{state?.grid?.drop_stations?.length || 0}</span>
          </div>

          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/70">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-cyan-400 shadow-sm shadow-cyan-400/50 flex items-center justify-center text-[7px] text-black font-bold">
                ⚡
              </span>
              <span className="text-slate-300">Charging Pad</span>
            </div>
            <span className="text-slate-500 text-[10px]">{state?.grid?.charging_stations?.length || 0}</span>
          </div>

          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/70">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-rose-600 shadow-sm shadow-rose-600/50 animate-pulse"></span>
              <span className="text-slate-300">VVIP Corridor</span>
            </div>
            <span className={`text-[10px] font-bold ${state?.emergency?.active ? 'text-rose-400' : 'text-slate-500'}`}>
              {state?.emergency?.active ? 'ON' : 'OFF'}
            </span>
          </div>

          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/70">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-amber-400 shadow-sm shadow-amber-400/50"></span>
              <span className="text-slate-300">Yielding AGV</span>
            </div>
            <span className="text-slate-500 text-[10px]">{state?.emergency?.yieldingRobots?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* 4. FLEET QUICK STATUS */}
      <div className="p-3.5 mt-auto">
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-indigo-400" />
          <span>Swarm Quick Status</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between text-slate-400">
            <span>Total Fleet</span>
            <span className="font-bold text-white">{robots.length} AGVs</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${robots.length > 0 ? (activeCount / robots.length) * 100 : 0}%` }}
              title={`Active: ${activeCount}`}
            />
            <div
              className="bg-cyan-500 h-full transition-all duration-300"
              style={{ width: `${robots.length > 0 ? (chargingCount / robots.length) * 100 : 0}%` }}
              title={`Charging: ${chargingCount}`}
            />
            <div
              className="bg-slate-600 h-full transition-all duration-300"
              style={{ width: `${robots.length > 0 ? (idleCount / robots.length) * 100 : 0}%` }}
              title={`Idle: ${idleCount}`}
            />
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px] text-center pt-1 text-slate-400">
            <div>
              <span className="text-emerald-400 font-bold">{activeCount}</span> Active
            </div>
            <div>
              <span className="text-cyan-400 font-bold">{chargingCount}</span> Charge
            </div>
            <div>
              <span className="text-slate-400 font-bold">{idleCount}</span> Idle
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
