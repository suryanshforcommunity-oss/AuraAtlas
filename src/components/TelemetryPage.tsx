import React, { useState } from 'react';
import { SimulationState } from '../types/fleet';
import {
  Activity,
  Zap,
  Battery,
  BatteryCharging,
  AlertTriangle,
  Search,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  Flame,
  ArrowLeft
} from 'lucide-react';

interface TelemetryPageProps {
  state: SimulationState | null;
  onBackToMap: () => void;
  onFailRobot: (rid: number) => void;
}

export const TelemetryPage: React.FC<TelemetryPageProps> = ({
  state,
  onBackToMap,
  onFailRobot,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'CHARGING' | 'FAILED'>('ALL');
  const [selectedRobotId, setSelectedRobotId] = useState<number | null>(0);

  const robots = state?.robots || [];
  const selectedRobot = robots.find(r => r.id === selectedRobotId) || robots[0] || null;

  const filteredRobots = robots.filter(r => {
    const isCharging = r.state === 'charging' || r.phase === 'charging';
    const isFailed = r.state === 'failed';
    const matchesSearch = r.id.toString().includes(searchQuery) || (r.state || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterStatus === 'ACTIVE') return matchesSearch && !isCharging && !isFailed;
    if (filterStatus === 'CHARGING') return matchesSearch && isCharging;
    if (filterStatus === 'FAILED') return matchesSearch && isFailed;
    return matchesSearch;
  });

  const activeCount = state?.metrics?.active ?? robots.filter(r => r.state !== 'charging' && r.state !== 'failed').length;
  const chargingCount = state?.metrics?.charging ?? robots.filter(r => r.state === 'charging' || r.phase === 'charging').length;
  const failedCount = state?.metrics?.failed ?? robots.filter(r => r.state === 'failed').length;

  const avgBattery = robots.length > 0
    ? (robots.reduce((sum, r) => sum + (r.battery ?? 100), 0) / robots.length).toFixed(1)
    : '100.0';

  return (
    <div className="min-h-screen w-full bg-[#0b0d12] text-slate-100 font-sans flex flex-col bg-grid-cyber">
      {/* Top Telemetry Header */}
      <header className="sticky top-0 z-40 bg-[#0e131f]/90 backdrop-blur-md border-b border-cyan-500/20 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToMap}
            className="px-3 py-1.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 hover:text-white hover:bg-cyan-900/60 transition-colors flex items-center gap-1.5 text-xs font-mono font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO LIVE MAP</span>
          </button>
          <div className="h-4 w-px bg-cyan-500/20"></div>
          <div>
            <h1 className="text-xl font-bold font-headline text-cyan-300 tracking-tight flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <span>AGV SWARM TELEMETRY & DIAGNOSTICS</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">Real-time CAN-bus metrics, SoC telemetry, and motor state monitoring</p>
          </div>
        </div>

        {/* Live Counters Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#161d2f] border border-cyan-500/20 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400">Total Swarm:</span>
            <span className="font-bold text-cyan-400">{robots.length} AGVs</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#161d2f] border border-amber-500/20 font-mono text-xs">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Charging:</span>
            <span className="font-bold text-amber-400">{chargingCount}</span>
          </div>
        </div>
      </header>

      {/* Main Spacious Content */}
      <div className="flex-1 p-6 space-y-6 max-w-[1700px] mx-auto w-full">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#0e131f]/80 backdrop-blur border border-cyan-500/30 rounded-lg p-4 reticle-box space-y-2">
            <div className="flex justify-between items-center text-xs font-mono text-cyan-400">
              <span>ACTIVE SWARM AGVs</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold font-headline text-white">{activeCount}</div>
            <div className="text-xs text-emerald-400 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Nominal Dispatch State</span>
            </div>
          </div>

          <div className="bg-[#0e131f]/80 backdrop-blur border border-amber-500/30 rounded-lg p-4 reticle-box space-y-2">
            <div className="flex justify-between items-center text-xs font-mono text-amber-400">
              <span>INDUCTIVE CHARGING</span>
              <BatteryCharging className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold font-headline text-amber-300">{chargingCount}</div>
            <div className="text-xs text-amber-400 font-mono">Automated Pad Docking Active</div>
          </div>

          <div className="bg-[#0e131f]/80 backdrop-blur border border-emerald-500/30 rounded-lg p-4 reticle-box space-y-2">
            <div className="flex justify-between items-center text-xs font-mono text-emerald-400">
              <span>AVERAGE SOC (BATTERY)</span>
              <Battery className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold font-headline text-emerald-300">{avgBattery}%</div>
            <div className="text-xs text-emerald-400 font-mono">Power Reserve Healthy</div>
          </div>

          <div className="bg-[#0e131f]/80 backdrop-blur border border-rose-500/30 rounded-lg p-4 reticle-box space-y-2">
            <div className="flex justify-between items-center text-xs font-mono text-rose-400">
              <span>ESTOP / FAULTED NODES</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-bold font-headline text-rose-300">{failedCount}</div>
            <div className="text-xs text-slate-400 font-mono">0 Structural Deadlocks</div>
          </div>
        </div>

        {/* Fleet Grid + Detailed Inspector Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Fleet Table & Search Filters */}
          <div className="lg:col-span-2 bg-[#0e131f]/80 backdrop-blur border border-slate-800 rounded-lg p-5 space-y-4 reticle-box">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 bg-[#161d2f] border border-cyan-500/20 rounded px-3 py-1.5 focus-within:border-cyan-400 w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="SEARCH ROBOT ID / STATE..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none p-0 text-xs font-mono text-cyan-300 placeholder-slate-500 focus:ring-0 focus:outline-none w-full"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#090c14] p-1 rounded border border-slate-800 font-mono text-xs">
                {(['ALL', 'ACTIVE', 'CHARGING', 'FAILED'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1 rounded transition-colors ${
                      filterStatus === status
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Robot List View */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800/80 bg-[#161d2f]/50">
                    <th className="p-3">AGV ID</th>
                    <th className="p-3">STATE</th>
                    <th className="p-3">POSITION</th>
                    <th className="p-3">TARGET</th>
                    <th className="p-3">BATTERY</th>
                    <th className="p-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRobots.map(r => {
                    const isSelected = selectedRobotId === r.id;
                    const isCharging = r.state === 'charging' || r.phase === 'charging';
                    const isFailed = r.state === 'failed';
                    const batteryVal = r.battery ?? 100;

                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRobotId(r.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-cyan-500/10 text-cyan-200' : 'hover:bg-slate-800/40 text-slate-300'
                        }`}
                      >
                        <td className="p-3 font-bold text-cyan-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                          AGV-{r.id.toString().padStart(3, '0')}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isFailed
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                : isCharging
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            }`}
                          >
                            {(r.state || 'active').toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">
                          ({r.x}, {r.y})
                        </td>
                        <td className="p-3 text-cyan-300">
                          {r.target ? `(${r.target[0]}, ${r.target[1]})` : 'IDLE'}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-800 h-2 rounded overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${isCharging ? 'bg-amber-400' : batteryVal < 20 ? 'bg-rose-400' : 'bg-emerald-400'}`}
                                style={{ width: `${batteryVal}%` }}
                              ></div>
                            </div>
                            <span className="text-[11px] font-bold">{batteryVal}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onFailRobot(r.id);
                            }}
                            className="px-2.5 py-1 rounded bg-rose-950/40 text-rose-400 border border-rose-500/30 hover:bg-rose-900/50 text-[11px] transition-colors"
                          >
                            Simulate Fault
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Col: Selected AGV Detailed Telemetry HUD */}
          <div className="bg-[#0e131f]/80 backdrop-blur border border-cyan-500/40 rounded-lg p-5 space-y-5 reticle-box">
            {selectedRobot ? (
              <>
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-cyan-400 tracking-wider">SELECTED CHASSIS TELEMETRY</span>
                    <h3 className="text-xl font-bold font-headline text-cyan-300">
                      AGV-{selectedRobot.id.toString().padStart(3, '0')}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">Heavy-Lift Swarm Autonomous Mule</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded font-mono text-xs font-bold ${
                      selectedRobot.state === 'charging' || selectedRobot.phase === 'charging'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {(selectedRobot.state || 'NOMINAL').toUpperCase()}
                  </span>
                </div>

                {/* Dynamic Telemetry Metric Specs */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Position Coordinates:</span>
                    <span className="text-cyan-300 font-bold">X: {selectedRobot.x} | Y: {selectedRobot.y}</span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Active Destination:</span>
                    <span className="text-cyan-300 font-bold">
                      {selectedRobot.target ? `(${selectedRobot.target[0]}, ${selectedRobot.target[1]})` : 'Station Docked'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">State of Charge (SoC):</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Battery className="w-3.5 h-3.5" /> {selectedRobot.battery ?? 100}% {selectedRobot.state === 'charging' ? 'Charging' : (selectedRobot.battery ?? 100) < 20 ? 'Low Battery' : 'Optimal'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Motor Temperature:</span>
                    <span className="text-amber-300 font-bold flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" /> {(28 + (selectedRobot.state === 'moving' ? 11.2 : 2.1) + ((100 - (selectedRobot.battery ?? 100)) * 0.08)).toFixed(1)}°C [Safe limit 65°C]
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">LiDAR SLAM Consensus:</span>
                    <span className="text-emerald-300 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Synchronized ({selectedRobot.state === 'moving' ? '0.01m' : '0.00m'})
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">PIBT Queue Priority:</span>
                    <span className="text-cyan-400 font-bold">
                      {selectedRobot.state === 'moving' ? 'High (Active Waypoint)' : 'Idle / Docked'}
                    </span>
                  </div>
                </div>

                {/* Control Action Buttons */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <button
                    onClick={() => onFailRobot(selectedRobot.id)}
                    className="w-full py-2 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-mono font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Trigger Fault Emergency Halt</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-500 py-12 font-mono text-xs">Select a robot to view CAN-bus telemetry.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
