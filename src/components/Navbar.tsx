import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Flame,
  Route,
  ShieldAlert,
  PlusCircle,
  Map,
  Activity,
  Zap,
  StepForward,
  Home,
  Trash2,
  CheckCircle2,
  Server,
  Siren
} from 'lucide-react';
import { SimulationState } from '../types/fleet';

interface NavbarProps {
  state: SimulationState | null;
  connected: boolean;
  heatOn: boolean;
  routeOn: boolean;
  blockMode: boolean;
  onToggleStart: () => void;
  onStep: () => void;
  onReset: () => void;
  onToggleHeat: () => void;
  onToggleRoutes: () => void;
  onToggleBlock: () => void;
  onOpenOrderModal: () => void;
  onOpenMapModal: () => void;
  onNavigateHome?: () => void;
  onNavigateArchitecture?: () => void;
  onNavigateTelemetry?: () => void;
  onNavigateAnalytics?: () => void;
  onClearBlocks?: () => void;
  onOpenEmergencyModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  state,
  connected,
  heatOn,
  routeOn,
  blockMode,
  onToggleStart,
  onStep,
  onReset,
  onToggleHeat,
  onToggleRoutes,
  onToggleBlock,
  onOpenOrderModal,
  onOpenMapModal,
  onNavigateHome,
  onNavigateArchitecture,
  onNavigateTelemetry,
  onNavigateAnalytics,
  onClearBlocks,
  onOpenEmergencyModal,
}) => {
  const isRunning = state?.running ?? false;
  const tick = state?.tick ?? 0;

  return (
    <header className="h-16 bg-[#0b0f19]/90 border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between z-30 backdrop-blur-md">
      {/* Left Title & Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0b0f19] ${
                connected ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-rose-500'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                FleetSync <span className="text-indigo-400 font-semibold text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">AI Coordinator</span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>Multi-Agent Path Finding & Swarm Orchestration</span>
              <span className="inline-block w-1 h-1 rounded-full bg-slate-600"></span>
              <span className="text-indigo-300 font-mono">v2.4 TypeScript</span>
            </p>
          </div>
        </div>

        {/* Live Tick Pill */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
          <Activity className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '4s' }} />
          <span className="text-slate-400">Tick:</span>
          <span className="font-mono font-bold text-indigo-300">{tick}</span>
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
        </div>
      </div>

      {/* Center Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleStart}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md ${
            isRunning
              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
          }`}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isRunning ? 'Pause' : 'Start Swarm'}</span>
        </button>

        <button
          onClick={onStep}
          disabled={isRunning}
          title="Advance single tick"
          className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <StepForward className="w-4 h-4" />
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        <div className="h-4 w-px bg-slate-800 mx-1 hidden md:block"></div>

        {/* Toggles */}
        <div className="hidden md:flex items-center gap-1.5">
          <button
            onClick={onToggleHeat}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              heatOn
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 glow-rose'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Heatmap</span>
          </button>

          <button
            onClick={onToggleRoutes}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              routeOn
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 glow-indigo'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Route className="w-3.5 h-3.5" />
            <span>Routes</span>
          </button>

          <button
            onClick={onToggleBlock}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              blockMode
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 glow-amber'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{blockMode ? 'Block Active' : 'Block Mode'}</span>
          </button>

          {onClearBlocks && (
            <button
              onClick={onClearBlocks}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 transition-all"
              title="Clear all user-added obstacles"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Blocks</span>
            </button>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {onNavigateHome && (
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 transition-all"
            title="Return to Landing Page"
          >
            <Home className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Landing Page</span>
          </button>
        )}

        {onNavigateTelemetry && (
          <button
            onClick={onNavigateTelemetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 transition-all"
            title="AGV Swarm Telemetry"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Telemetry</span>
          </button>
        )}

        {onNavigateAnalytics && (
          <button
            onClick={onNavigateAnalytics}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 transition-all"
            title="Swarm Heatmaps & Analytics"
          >
            <Route className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Analytics</span>
          </button>
        )}

        {onNavigateArchitecture && (
          <button
            onClick={onNavigateArchitecture}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 transition-all"
            title="View System Architecture"
          >
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Architecture</span>
          </button>
        )}

        {onOpenEmergencyModal && (
          <button
            onClick={onOpenEmergencyModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md ${
              state?.emergency?.active
                ? 'bg-rose-600 text-white border border-rose-400 shadow-rose-600/30 animate-pulse'
                : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
            }`}
            title="Activate Dynamic Emergency / VVIP Corridor"
          >
            <Siren className="w-3.5 h-3.5 text-rose-400" />
            <span>{state?.emergency?.active ? 'Corridor Active' : 'Emergency Corridor'}</span>
          </button>
        )}

        <button
          onClick={onOpenOrderModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-md shadow-indigo-500/20 border border-indigo-400/30 transition-all"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Dispatch Order</span>
        </button>

        <button
          onClick={onOpenMapModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 transition-all"
        >
          <Map className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Map & Swarm</span>
        </button>
      </div>
    </header>
  );
};
