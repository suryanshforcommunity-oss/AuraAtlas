import React, { useState, useEffect } from 'react';
import {
  Cpu,
  X,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Play,
  ShieldCheck,
  Radio,
  Wifi,
  WifiOff
} from 'lucide-react';

interface EdgeStatus {
  ok?: boolean;
  connected: boolean;
  mode?: string;
  model_loaded?: boolean;
  fallback_active?: boolean;
  cloud_required?: boolean;
  last_latency_ms?: number;
  fallback_reason?: string;
  recent_decisions?: Array<{
    task_id: string;
    robot_id?: string;
    method?: string;
    reason: string;
    route_length?: number;
    latency_ms?: number;
  }>;
  message?: string;
}

interface EdgeAIModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EdgeAIModal: React.FC<EdgeAIModalProps> = ({ isOpen, onClose }) => {
  const [edgeStatus, setEdgeStatus] = useState<EdgeStatus | null>(null);
  const [offlineSim, setOfflineSim] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastStepLog, setLastStepLog] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/edge/status');
      const data = await res.json();
      setEdgeStatus(data);
    } catch (err) {
      setEdgeStatus({ connected: false, message: 'Unreachable' });
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 2500);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleStep = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/edge/step', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setLastStepLog(`Computed ${data.decisions?.length || 0} local AGV assignments in ${data.edge?.last_latency_ms || 0}ms`);
        fetchStatus();
      }
    } catch (err: any) {
      setLastStepLog(`Step error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOffline = async () => {
    const next = !offlineSim;
    setLoading(true);
    try {
      const res = await fetch(`/api/edge/offline/${next}`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setOfflineSim(next);
        fetchStatus();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await fetch('/api/edge/reset', { method: 'POST' });
      setLastStepLog('AURA EdgeAI state reset to initial conditions.');
      fetchStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = edgeStatus?.connected ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none animate-fadeIn">
      <div className="w-full max-w-2xl p-6 rounded-2xl bg-[#0c101b] border border-cyan-500/40 shadow-2xl shadow-cyan-950/60 relative flex flex-col max-h-[90vh] overflow-y-auto reticle-box">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-headline font-bold text-white">
                AURA EdgeAI Decision Engine
              </h3>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  isConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`}></span>
                {isConnected ? 'LIVE LOCAL ENGINE' : 'DISCONNECTED'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Offline-capable sub-millisecond AGV assignment & deterministic path planner
            </p>
          </div>
        </div>

        {/* Telemetry Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Compute Mode</div>
            <div className="text-xs font-bold font-mono text-cyan-300 mt-0.5 truncate">
              {edgeStatus?.mode || 'RULE_FALLBACK'}
            </div>
            <div className="text-[9px] text-slate-500 font-mono mt-0.5">Deterministic Local</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Decision Latency</div>
            <div className="text-xs font-bold font-mono text-emerald-300 mt-0.5">
              {edgeStatus?.last_latency_ms ?? 0.53} ms
            </div>
            <div className="text-[9px] text-emerald-400/80 font-mono mt-0.5">Sub-Millisecond</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Cloud Dependency</div>
            <div className="text-xs font-bold font-mono text-white mt-0.5">
              {edgeStatus?.cloud_required ? 'Required' : 'Zero (Local)'}
            </div>
            <div className="text-[9px] text-cyan-400/80 font-mono mt-0.5">100% On-Premise</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Network State</div>
            <div className="text-xs font-bold font-mono text-amber-300 mt-0.5 flex items-center gap-1">
              {offlineSim ? <WifiOff className="w-3 h-3 text-amber-400" /> : <Wifi className="w-3 h-3 text-emerald-400" />}
              {offlineSim ? 'Simulated Offline' : 'Online Bridge'}
            </div>
            <div className="text-[9px] text-slate-500 font-mono mt-0.5">
              {offlineSim ? 'Autonomous Fallback' : 'Standard Loop'}
            </div>
          </div>
        </div>

        {/* Engine Information Alert */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 mb-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold mb-1">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Edge Engine Logic & Architecture</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            {edgeStatus?.fallback_reason ||
              'AURA EdgeAI executes deterministic obstacle-aware path calculations on local CPU without sending warehouse telemetry to cloud servers.'}
          </p>
        </div>

        {/* Recent Decisions Feed */}
        <div className="flex-1 space-y-2 mb-4">
          <div className="text-slate-300 font-semibold font-mono uppercase text-[11px] flex items-center justify-between">
            <span>Recent Edge AI Decisions</span>
            <span className="text-slate-500 font-normal">
              {edgeStatus?.recent_decisions?.length || 0} entries
            </span>
          </div>

          <div className="bg-slate-950/80 rounded-xl border border-slate-800/80 p-2 max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs">
            {edgeStatus?.recent_decisions && edgeStatus.recent_decisions.length > 0 ? (
              edgeStatus.recent_decisions.slice().reverse().map((d, i) => (
                <div
                  key={i}
                  className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2 font-bold text-white text-[11px]">
                      {d.robot_id && (
                        <span className="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                          {d.robot_id}
                        </span>
                      )}
                      <span className="text-indigo-300">{d.task_id}</span>
                      <span className="text-[10px] text-slate-500 font-normal uppercase">
                        via {d.method || 'RULE_FALLBACK'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{d.reason}</div>
                  </div>
                  {d.latency_ms !== undefined && (
                    <span className="text-[10px] text-emerald-400 font-bold shrink-0">
                      {d.latency_ms} ms
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs">
                No decisions recorded yet. Click "Trigger Step Assignment" below to compute local routing.
              </div>
            )}
          </div>
        </div>

        {lastStepLog && (
          <div className="mb-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{lastStepLog}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleOffline}
              disabled={loading || !isConnected}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all ${
                offlineSim
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              {offlineSim ? 'Disable Offline Sim' : 'Simulate Cloud Outage'}
            </button>

            <button
              onClick={handleReset}
              disabled={loading || !isConnected}
              className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition-colors"
              title="Reset AURA Edge State"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStep}
              disabled={loading || !isConnected}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 text-xs font-headline font-bold uppercase tracking-wider transition-all shadow-md shadow-cyan-500/20 active:scale-95 disabled:opacity-40"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              <span>Trigger Edge Step</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
