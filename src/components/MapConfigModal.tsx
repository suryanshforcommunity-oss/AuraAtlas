import React, { useState, useEffect } from 'react';
import { X, Map, Download, RefreshCw, Cpu, Layers, Check, Compass, Boxes, Grid as GridIcon } from 'lucide-react';

interface MapConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchMap: (mapName: string, numRobots: number, capacity: number) => Promise<void>;
  onDownloadMap: (mapName: string) => Promise<void>;
}

interface MapMeta {
  id: string;
  name: string;
  category: 'warehouse' | 'maze' | 'random' | 'open';
  dim: string;
  desc: string;
}

const MAP_METADATA: MapMeta[] = [
  {
    id: 'custom',
    name: 'Structured Pod Warehouse (Default)',
    category: 'warehouse',
    dim: '36 × 28 Grid',
    desc: '6 double-deep storage rack pods, perimeter aisles, pick stations & drop docks.',
  },
  {
    id: 'warehouse-10-20-10-2-1',
    name: 'Warehouse 10-20 Small Pods',
    category: 'warehouse',
    dim: '36 × 24 Grid',
    desc: 'Standard warehouse pod layout with vertical cross-aisles and perimeter hubs.',
  },
  {
    id: 'warehouse-20-40-10-2-1',
    name: 'Warehouse 20-40 Distribution Center',
    category: 'warehouse',
    dim: '48 × 32 Large Grid',
    desc: 'Expanded distribution hub with multi-bay matrices and high-density dispatch.',
  },
  {
    id: 'maze-32-32-2',
    name: 'Maze Nexus 32×32',
    category: 'maze',
    dim: '32 × 32 Maze Grid',
    desc: 'Intricate corridor walls & dead-ends designed to test PIBT dynamic yield routing.',
  },
  {
    id: 'random-32-32-10',
    name: 'Random Scatter Obstacles 32×32',
    category: 'random',
    dim: '32 × 32 Scatter Grid',
    desc: '22% random obstacle density scatter field testing multi-robot path rerouting.',
  },
  {
    id: 'empty-32-32',
    name: 'Open Fleet Arena 32×32',
    category: 'open',
    dim: '32 × 32 Open Floor',
    desc: 'Clear open grid space for max speed swarm coordination testing.',
  },
];

export const MapConfigModal: React.FC<MapConfigModalProps> = ({
  isOpen,
  onClose,
  onSwitchMap,
  onDownloadMap,
}) => {
  const [availableMaps, setAvailableMaps] = useState<string[]>(['custom']);
  const [selectedMap, setSelectedMap] = useState<string>('custom');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [numRobots, setNumRobots] = useState<number>(8);
  const [capacity, setCapacity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/map/available')
        .then(r => r.json())
        .then(d => {
          if (d.maps) setAvailableMaps(d.maps);
        })
        .catch(err => console.error(err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (selectedMap === 'custom') {
      setStatusMsg({ text: 'Custom map layout requires no external download', type: 'info' });
      return;
    }
    setLoading(true);
    setStatusMsg({ text: `Initializing ${selectedMap}...`, type: 'info' });
    try {
      await onDownloadMap(selectedMap);
      setStatusMsg({ text: `Map ${selectedMap} downloaded & ready ✓`, type: 'success' });
    } catch (e: any) {
      setStatusMsg({ text: `Download failed: ${e.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMap = async () => {
    setLoading(true);
    setStatusMsg({ text: 'Reconfiguring map & spawning swarm...', type: 'info' });
    try {
      await onSwitchMap(selectedMap, numRobots, capacity);
      setStatusMsg({ text: 'Map & Swarm successfully loaded!', type: 'success' });
      setTimeout(() => {
        onClose();
      }, 400);
    } catch (e: any) {
      setStatusMsg({ text: `Load failed: ${e.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Combine dynamic API list with metadata fallback
  const mapListToRender = availableMaps.map(mapId => {
    const meta = MAP_METADATA.find(m => m.id === mapId);
    if (meta) return meta;
    return {
      id: mapId,
      name: mapId.replace(/-/g, ' ').toUpperCase(),
      category: mapId.startsWith('maze') ? 'maze' : mapId.startsWith('random') ? 'random' : 'warehouse',
      dim: 'Dynamic Grid',
      desc: 'Benchmark map layout.',
    } as MapMeta;
  });

  const filteredMaps = activeCategory === 'all'
    ? mapListToRender
    : mapListToRender.filter(m => m.category === activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl p-6 rounded-2xl bg-[#0b0f19] border border-slate-800 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Map className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Warehouse Map Benchmark Gallery</h3>
            <p className="text-xs text-slate-400">Select map layout, customize fleet count, and apply changes</p>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3 overflow-x-auto">
          {['all', 'warehouse', 'maze', 'random', 'open'].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Scrollable Map Card Grid */}
        <div className="flex-1 overflow-y-auto pr-1 my-2 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px]">
          {filteredMaps.map(m => {
            const isSelected = selectedMap === m.id;
            return (
              <div
                key={m.id}
                onClick={() => setSelectedMap(m.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-950/40 border-cyan-400/80 ring-1 ring-cyan-400/50 shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      {m.category === 'maze' && <Compass className="w-3.5 h-3.5 text-indigo-400" />}
                      {m.category === 'warehouse' && <Layers className="w-3.5 h-3.5 text-cyan-400" />}
                      {m.category === 'random' && <Boxes className="w-3.5 h-3.5 text-purple-400" />}
                      {m.category === 'open' && <GridIcon className="w-3.5 h-3.5 text-emerald-400" />}
                      {m.name}
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal mb-2">{m.desc}</p>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono">
                  <span>{m.dim}</span>
                  <span className="capitalize px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {m.category}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Fleet Controls */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              Swarm AGVs (1 - 50)
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={numRobots}
              onChange={e => setNumRobots(parseInt(e.target.value, 10) || 5)}
              className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Package Capacity / AGV
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={capacity}
              onChange={e => setCapacity(parseInt(e.target.value, 10) || 1)}
              className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            className={`mt-3 p-2 rounded-xl text-xs font-medium ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : statusMsg.type === 'error'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="flex gap-3 pt-3 mt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || selectedMap === 'custom'}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Init Benchmark</span>
          </button>

          <button
            type="button"
            onClick={handleLoadMap}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Load & Launch Map</span>
          </button>
        </div>
      </div>
    </div>
  );
};
