import React, { useState, useEffect } from 'react';
import { SimulationState, StationData } from '../types/fleet';
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
  PackagePlus,
  MapPin,
  Truck
} from 'lucide-react';

interface EmergencyCorridorModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: SimulationState | null;
  onActivate: (
    robotId: number,
    pickupX: number,
    pickupY: number,
    dropoffX: number,
    dropoffY: number
  ) => Promise<any>;
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

  const pickStations = stations.filter(s => s.type === 'pick');
  const dropStations = stations.filter(s => s.type === 'drop');

  const [selectedRobotId, setSelectedRobotId] = useState<number>(robots[0]?.id ?? 0);

  // Pickup configuration
  const [pickupType, setPickupType] = useState<'station' | 'custom'>('station');
  const [selectedPickId, setSelectedPickId] = useState<number>(pickStations[0]?.id ?? 0);
  const [customPickX, setCustomPickX] = useState<number>(2);
  const [customPickY, setCustomPickY] = useState<number>(4);

  // Dropoff configuration
  const [dropType, setDropType] = useState<'station' | 'custom'>('station');
  const [selectedDropId, setSelectedDropId] = useState<number>(dropStations[0]?.id ?? 0);
  const [customDropX, setCustomDropX] = useState<number>(grid?.width ? grid.width - 3 : 20);
  const [customDropY, setCustomDropY] = useState<number>(4);

  const [previewRoute, setPreviewRoute] = useState<[number, number][] | null>(null);
  const [fullRoute, setFullRoute] = useState<[number, number][] | null>(null);
  const [previewIntersections, setPreviewIntersections] = useState<[number, number][]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Auto-select valid initial defaults
  useEffect(() => {
    if (robots.length > 0 && !robots.some(r => r.id === selectedRobotId)) {
      setSelectedRobotId(robots[0].id);
    }
    if (pickStations.length > 0 && !pickStations.some(s => s.id === selectedPickId)) {
      setSelectedPickId(pickStations[0].id);
    }
    if (dropStations.length > 0 && !dropStations.some(s => s.id === selectedDropId)) {
      setSelectedDropId(dropStations[0].id);
    }
  }, [robots, stations]);

  const getPickupCoords = (): [number, number] => {
    if (pickupType === 'station') {
      const st = stations.find(s => s.id === selectedPickId);
      if (st) return [st.x, st.y];
      if (grid?.pick_stations && grid.pick_stations.length > 0) return grid.pick_stations[0];
      return [2, 2];
    }
    return [customPickX, customPickY];
  };

  const getDropoffCoords = (): [number, number] => {
    if (dropType === 'station') {
      const st = stations.find(s => s.id === selectedDropId);
      if (st) return [st.x, st.y];
      if (grid?.drop_stations && grid.drop_stations.length > 0) return grid.drop_stations[0];
      return [grid?.width ? grid.width - 2 : 20, 2];
    }
    return [customDropX, customDropY];
  };

  const handlePreview = async () => {
    const pCoords = getPickupCoords();
    const dCoords = getDropoffCoords();
    setLoading(true);
    setPreviewError(null);

    try {
      const res = await fetch('/api/emergency/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          robotId: selectedRobotId,
          pickupX: pCoords[0],
          pickupY: pCoords[1],
          dropoffX: dCoords[0],
          dropoffY: dCoords[1],
        }),
      });
      const data = await res.json();
      if (data.ok && data.route) {
        setPreviewRoute(data.route);
        setFullRoute(data.fullRoute || data.route);
        setPreviewIntersections(data.intersections || []);
      } else {
        setPreviewRoute(null);
        setFullRoute(null);
        setPreviewError(data.error || 'Failed to establish emergency corridor route');
      }
    } catch (err: any) {
      setPreviewError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handlePreview();
    }
  }, [
    isOpen,
    selectedRobotId,
    pickupType,
    selectedPickId,
    customPickX,
    customPickY,
    dropType,
    selectedDropId,
    customDropX,
    customDropY,
  ]);

  const handleActivateCorridor = async () => {
    const pCoords = getPickupCoords();
    const dCoords = getDropoffCoords();
    setLoading(true);
    try {
      await onActivate(selectedRobotId, pCoords[0], pCoords[1], dCoords[0], dCoords[1]);
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

  const isCorridorActive = emergency?.active ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div className="w-full max-w-2xl p-6 rounded-2xl bg-[#0c101b] border border-rose-500/40 shadow-2xl shadow-rose-950/60 relative flex flex-col max-h-[90vh] overflow-y-auto reticle-box">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/20 animate-pulse">
            <Siren className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-headline font-bold text-white flex items-center gap-2">
              Dynamic Emergency Corridor
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider">
                VVIP 2-Phase Delivery
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Reserve an exclusive fast-track corridor from Robot → Pickup Station → Dropoff Dock
            </p>
          </div>
        </div>

        {/* Active Corridor Alert Banner */}
        {isCorridorActive && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
              <div>
                <div className="text-xs font-bold font-headline text-rose-300">
                  CORRIDOR CURRENTLY ACTIVE: Robot {emergency?.robotId}
                </div>
                <div className="text-[11px] text-slate-300 font-mono">
                  Phase: {emergency?.phase === 'to_pickup' ? 'En route to Pickup' : 'Delivering to Dropoff'} • {emergency?.yieldingRobots?.length || 0} AGVs yielding
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

        <div className="space-y-4 flex-1 text-xs">
          {/* Step 1: Select Emergency Robot */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 font-mono uppercase tracking-wider text-[11px]">
              1. Select Priority AGV
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {robots.map(r => {
                const isSelected = r.id === selectedRobotId;
                const isFailed = r.state === 'failed';
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={isFailed}
                    onClick={() => setSelectedRobotId(r.id)}
                    className={`p-2 rounded-xl border text-left transition-all flex flex-col gap-0.5 ${
                      isSelected
                        ? 'bg-rose-500/20 border-rose-500 text-white shadow-md shadow-rose-500/20'
                        : isFailed
                        ? 'opacity-40 bg-slate-900/40 border-slate-800 cursor-not-allowed'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold text-xs">
                      <span>Robot {r.id}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      ({r.x}, {r.y}) • {r.battery}%
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Select Pickup Location */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <label className="text-emerald-400 font-semibold font-mono uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                2. Phase A: VIP Pickup Location
              </label>
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setPickupType('station')}
                  className={`px-2 py-0.5 rounded ${
                    pickupType === 'station' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Pick Station
                </button>
                <button
                  type="button"
                  onClick={() => setPickupType('custom')}
                  className={`px-2 py-0.5 rounded ${
                    pickupType === 'custom' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Custom (X, Y)
                </button>
              </div>
            </div>

            {pickupType === 'station' ? (
              <select
                value={selectedPickId}
                onChange={e => setSelectedPickId(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
              >
                {pickStations.map(s => (
                  <option key={s.id} value={s.id}>
                    Pickup #{s.id} at ({s.x}, {s.y}) — Stock: {s.current}/{s.max}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-mono">Pickup X</label>
                  <input
                    type="number"
                    min={0}
                    max={grid?.width ? grid.width - 1 : 32}
                    value={customPickX}
                    onChange={e => setCustomPickX(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full mt-0.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-mono">Pickup Y</label>
                  <input
                    type="number"
                    min={0}
                    max={grid?.height ? grid.height - 1 : 32}
                    value={customPickY}
                    onChange={e => setCustomPickY(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full mt-0.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Select Dropoff Location */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <label className="text-orange-400 font-semibold font-mono uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-orange-400" />
                3. Phase B: VIP Dropoff Location
              </label>
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setDropType('station')}
                  className={`px-2 py-0.5 rounded ${
                    dropType === 'station' ? 'bg-orange-500/20 text-orange-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Drop Station
                </button>
                <button
                  type="button"
                  onClick={() => setDropType('custom')}
                  className={`px-2 py-0.5 rounded ${
                    dropType === 'custom' ? 'bg-orange-500/20 text-orange-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Custom (X, Y)
                </button>
              </div>
            </div>

            {dropType === 'station' ? (
              <select
                value={selectedDropId}
                onChange={e => setSelectedDropId(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-orange-500 focus:outline-none"
              >
                {dropStations.map(s => (
                  <option key={s.id} value={s.id}>
                    Drop Dock #{s.id} at ({s.x}, {s.y}) — Delivered: {s.current}/{s.max}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-mono">Dropoff X</label>
                  <input
                    type="number"
                    min={0}
                    max={grid?.width ? grid.width - 1 : 32}
                    value={customDropX}
                    onChange={e => setCustomDropX(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full mt-0.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-mono">Dropoff Y</label>
                  <input
                    type="number"
                    min={0}
                    max={grid?.height ? grid.height - 1 : 32}
                    value={customDropY}
                    onChange={e => setCustomDropY(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full mt-0.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 4: Verification & Preview Summary */}
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-300 font-mono text-[11px] flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5 text-cyan-400" />
                2-Phase Corridor Path Summary
              </span>
              {fullRoute && (
                <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Full Corridor Validated
                </span>
              )}
            </div>

            {previewError ? (
              <div className="text-rose-400 font-mono text-xs flex items-center gap-1.5 p-2 rounded bg-rose-500/10 border border-rose-500/30">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{previewError}</span>
              </div>
            ) : fullRoute ? (
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono mt-1.5">
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Total Route Cells</div>
                  <div className="text-sm font-bold text-white">{fullRoute.length} cells</div>
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Intersections</div>
                  <div className="text-sm font-bold text-amber-300">{previewIntersections.length} hubs</div>
                </div>
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Priority Level</div>
                  <div className="text-sm font-bold text-rose-400">Topmost (VVIP)</div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-center py-1 font-mono">
                Calculating 2-phase obstacle-free corridor...
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {isCorridorActive && (
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-xs font-mono font-bold transition-all"
              >
                Release Corridor
              </button>
            )}

            <button
              type="button"
              disabled={loading || !fullRoute || !!previewError}
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
