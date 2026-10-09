import React, { useState, useEffect } from 'react';
import { SimulationState, RobotData } from '../types/fleet';
import {
  Siren,
  X,
  AlertTriangle,
  Compass,
  Zap,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Route,
  Activity,
  Trash2
} from 'lucide-react';

interface EmergencyCorridorModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: SimulationState | null;
  onActivate: (robotId: number, targetX: number, targetY: number) => Promise<any>;
  onCancel: () => Promise<any>;
}

export const EmergencyCorridorModal: React.FC<EmergencyCorridorModalProps> = ({
  isOpen,
  onClose,
  state,
  onActivate,
  onCancel,
}) => {
  const robots = state?.robots || [];
  const stations = state?.stations || [];
  const grid = state?.grid;
  const emergency = state?.emergency;

  const [selectedRobotId, setSelectedRobotId] = useState<number>(robots[0]?.id ?? 0);
  const [destType, setDestType] = useState<'station' | 'custom'>('station');
  const [selectedStationId, setSelectedStationId] = useState<number>(stations[0]?.id ?? 0);
  const [customX, setCustomX] = useState<number>(10);
  const [customY, setCustomY] = useState<number>(10);

  const [previewRoute, setPreviewRoute] = useState<[number, number][] | null>(null);
  const [previewIntersections, setPreviewIntersections] = useState<[number, number][]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Auto-select valid robot
  useEffect(() => {
    if (robots.length > 0 && (!robots.some(r => r.id === selectedRobotId) || selectedRobotId === undefined)) {
      setSelectedRobotId(robots[0].id);
    }
  }, [robots, selectedRobotId]);

  // Determine target coordinates
  const getTargetCoords = (): [number, number] | null => {
    if (destType === 'station') {
      const st = stations.find(s => s.id === selectedStationId);
      if (st) return [st.x, st.y];
      if (grid?.drop_stations && grid.drop_stations.length > 0) return grid.drop_stations[0];
      return null;
    }
    return [customX, customY];
  };

  // Preview route calculation via API
  const handlePreview = async () => {
    const coords = getTargetCoords();
    if (!coords) return;
    setLoading(true);
    setPreviewError(null);

    try {
      const res = await fetch('/api/emergency/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          robotId: selectedRobotId,
          targetX: coords[0],
          targetY: coords[1],
        }),
      });
      const data = await res.json();
      if (data.ok && data.route) {
        setPreviewRoute(data.route);
        setPreviewIntersections(data.intersections || []);
      } else {
        setPreviewRoute(null);
        setPreviewError(data.error || 'Failed to establish route');
      }
    } catch (err: any) {
      setPreviewError(err.message || 'Error communicating with server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handlePreview();
    }
  }, [isOpen, selectedRobotId, selectedStationId, destType, customX, customY]);

  const handleActivateCorridor = async () => {
    const coords = getTargetCoords();
    if (!coords) return;
    setLoading(true);
    try {
      await onActivate(selectedRobotId, coords[0], coords[1]);
      onClose();
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to activate emergency corridor');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    setLoading(true);
    try {
      await onCancel();
      onClose();
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to release corridor');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedRobot = robots.find(r => r.id === selectedRobotId);
  const isCorridorActive = emergency?.active ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div className="w-full max-w-xl p-6 rounded-2xl bg-[#0c101b] border border-rose-500/40 shadow-2xl shadow-rose-950/60 relative flex flex-col max-h-[90vh] overflow-y-auto reticle-box">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/20 animate-pulse">
            <Siren className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-headline font-bold text-white flex items-center gap-2">
              Dynamic Emergency Corridor
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider">
                VVIP / Fast-Track
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Temporarily reserve an exclusive zero-delay corridor across the warehouse
            </p>
          </div>
        </div>

        {/* Active Corridor Alert Banner */}
        {isCorridorActive && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
              <div>
                <div className="text-xs font-bold font-headline text-rose-300">
                  CORRIDOR CURRENTLY ACTIVE: Robot {emergency?.robotId}
                </div>
                <div className="text-[11px] text-slate-300 font-mono">
                  Destination: ({emergency?.destination?.[0]}, {emergency?.destination?.[1]}) • {emergency?.yieldingRobots?.length || 0} robots yielding
                </div>
              </div>
            </div>
            <button
              onClick={handleDeactivate}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold transition-all"
            >
              Release Corridor
            </button>
          </div>
        )}

        <div className="space-y-5 flex-1 text-xs">
          {/* Step 1: Select Emergency Robot */}
          <div>
            <label className="block text-slate-300 font-semibold mb-2 font-mono uppercase tracking-wider text-[11px]">
              1. Select Priority / Emergency AGV
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {robots.map(r => {
                const isSelected = r.id === selectedRobotId;
                const isFailed = r.state === 'failed';
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={isFailed}
                    onClick={() => setSelectedRobotId(r.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-rose-500/20 border-rose-500 text-white shadow-md shadow-rose-500/20'
                        : isFailed
                        ? 'opacity-40 bg-slate-900/40 border-slate-800 cursor-not-allowed'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold">
                      <span>Robot {r.id}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Pos: ({r.x}, {r.y}) • Bat: {r.battery}%
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Select Destination */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-slate-300 font-semibold font-mono uppercase tracking-wider text-[11px]">
                2. Target Destination
              </label>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setDestType('station')}
                  className={`px-2 py-0.5 rounded ${
                    destType === 'station' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Station Node
                </button>
                <button
                  type="button"
                  onClick={() => setDestType('custom')}
                  className={`px-2 py-0.5 rounded ${
                    destType === 'custom' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Custom (X, Y)
                </button>
              </div>
            </div>

            {destType === 'station' ? (
              <select
                value={selectedStationId}
                onChange={e => setSelectedStationId(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs font-mono focus:border-rose-500 focus:outline-none"
              >
                {stations.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.type.toUpperCase()} Station #{s.id} at ({s.x}, {s.y}) — Stock: {s.current}/{s.max}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-mono">Grid X (0 to {grid?.width ? grid.width - 1 : 32})</label>
                  <input
                    type="number"
                    min={0}
                    max={grid?.width ? grid.width - 1 : 32}
                    value={customX}
                    onChange={e => setCustomX(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs font-mono focus:border-rose-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-mono">Grid Y (0 to {grid?.height ? grid.height - 1 : 32})</label>
                  <input
                    type="number"
                    min={0}
                    max={grid?.height ? grid.height - 1 : 32}
                    value={customY}
                    onChange={e => setCustomY(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs font-mono focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Dynamic Route Verification & Preview */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-300 font-mono text-[11px] flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5 text-cyan-400" />
                Dynamic Pathfinding Verification
              </span>
              {previewRoute && (
                <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Safe Route Verified
                </span>
              )}
            </div>

            {previewError ? (
              <div className="text-rose-400 font-mono text-xs flex items-center gap-1.5 p-2 rounded bg-rose-500/10 border border-rose-500/30">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{previewError}</span>
              </div>
            ) : previewRoute ? (
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono mt-2">
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Total Waypoints</div>
                  <div className="text-sm font-bold text-white">{previewRoute.length} cells</div>
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Intersections</div>
                  <div className="text-sm font-bold text-amber-300">{previewIntersections.length} hubs</div>
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Yield Policy</div>
                  <div className="text-sm font-bold text-rose-400">PIBT Exclusive</div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-center py-2 font-mono">
                Calculating dynamic obstacle-free route...
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-slate-800 flex items-center justify-between gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {isCorridorActive && (
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-xs font-mono font-bold transition-all"
              >
                Release Corridor
              </button>
            )}

            <button
              type="button"
              disabled={loading || !previewRoute || !!previewError}
              onClick={handleActivateCorridor}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-red-500 hover:from-rose-500 hover:to-red-400 text-white font-headline text-xs font-bold uppercase tracking-wider shadow-lg shadow-rose-500/30 border border-rose-400/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95 transition-all"
            >
              <Siren className="w-4 h-4 animate-bounce" />
              <span>Activate Emergency Corridor</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
