import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  PlusCircle,
  Map,
  Activity,
  StepForward,
  Siren,
  Wifi,
  Sparkles
} from 'lucide-react';
import { SimulationState } from '../types/fleet';

interface NavbarProps {
  state: SimulationState | null;
  connected: boolean;
  onToggleStart: () => void;
  onStep: () => void;
  onReset: () => void;
  onOpenOrderModal: () => void;
  onOpenMapModal: () => void;
  onOpenEmergencyModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  state,
  connected,
  onToggleStart,
  onStep,
  onReset,
  onOpenOrderModal,
  onOpenMapModal,
  onOpenEmergencyModal,
}) => {
  const isRunning = state?.running ?? false;
  const tick = state?.tick ?? 0;
  const isEmergency = state?.emergency?.active ?? false;

  return (
    <header className="h-16 bg-[#080c16]/95 border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between z-30 backdrop-blur-md select-none">
      {/* 1. Left: Brand & Live Tick Engine */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-slate-900/90 border border-cyan-500/40 p-1 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:border-cyan-400 group-hover:shadow-cyan-500/40 transition-all">
              <img
                src="/logo-icon.png"
                alt="FleetSync Hexagonal Swarm Logo"
                className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(0,240,255,0.7)] group-hover:scale-105 transition-transform"
              />
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#080c16] ${
                connected
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse'
                  : 'bg-cyan-400 shadow-sm shadow-cyan-400'
              }`}
              title={connected ? 'Live Simulation Engine Connected' : 'In-Browser Autonomous Engine Active'}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-wider flex items-center gap-1.5">
                <span className="text-white font-extrabold tracking-wide">FLEET</span>
                <span className="text-cyan-400 font-extrabold tracking-wide drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]">SYNC</span>
                <span className="text-cyan-300 font-semibold text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30">
                  {connected ? 'LIVE MESH' : 'DEMO ENGINE'}
                </span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>Autonomous Warehouse Coordinator</span>
              <span className="inline-block w-1 h-1 rounded-full bg-slate-600"></span>
              <span className="text-cyan-400 font-mono text-[10px]">v4.8 TS</span>
            </p>
          </div>
        </div>

        {/* Live Tick Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
          <Activity className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
          <span className="text-slate-400">Tick:</span>
          <span className="font-mono font-bold text-cyan-300">{tick}</span>
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
        </div>
      </div>

      {/* 2. Center: Primary Simulation Controls */}
      <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 shadow-inner">
        <button
          onClick={onToggleStart}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
            isRunning
              ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 shadow-amber-950/40'
              : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 shadow-emerald-950/40'
          }`}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isRunning ? 'Pause' : 'Start Swarm'}</span>
        </button>

        <button
          onClick={onStep}
          disabled={isRunning}
          title="Advance single simulation tick"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          <StepForward className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Step</span>
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold transition-all active:scale-95"
          title="Reset Simulation"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline">Reset</span>
        </button>
      </div>

      {/* 3. Right: Mission Critical Actions */}
      <div className="flex items-center gap-2">
        {/* Emergency / VVIP Corridor Trigger */}
        {onOpenEmergencyModal && (
          <button
            onClick={onOpenEmergencyModal}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 border ${
              isEmergency
                ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-400 shadow-rose-600/40 animate-pulse'
                : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 shadow-rose-950/30'
            }`}
            title="Activate Dynamic Emergency / VVIP Fast-Track Corridor"
          >
            <Siren className={`w-4 h-4 ${isEmergency ? 'animate-bounce text-white' : 'text-rose-400'}`} />
            <span className="hidden sm:inline">{isEmergency ? 'Corridor Active' : 'Emergency Corridor'}</span>
          </button>
        )}

        {/* Dispatch Order Action */}
        <button
          onClick={onOpenOrderModal}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-500/20 border border-cyan-400/30 transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Dispatch Order</span>
        </button>

        {/* Map & Swarm Configuration */}
        <button
          onClick={onOpenMapModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 transition-all active:scale-95"
          title="Select warehouse benchmark map & fleet sizing"
        >
          <Map className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden lg:inline">Map & Swarm</span>
        </button>
      </div>
    </header>
  );
};
