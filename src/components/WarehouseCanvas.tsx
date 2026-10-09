import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SimulationState, GridData } from '../types/fleet';
import { ZoomIn, ZoomOut, Maximize2, Move, Trash2, Zap, CheckCircle2 } from 'lucide-react';

interface WarehouseCanvasProps {
  state: SimulationState | null;
  heatOn: boolean;
  routeOn: boolean;
  blockMode: boolean;
  onBlockCell: (x: number, y: number) => void;
  onFailRobot?: (rid: number) => void;
  onClearBlocks?: () => void;
}

export const WarehouseCanvas: React.FC<WarehouseCanvasProps> = ({
  state,
  heatOn,
  routeOn,
  blockMode,
  onBlockCell,
  onClearBlocks,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cellSize, setCellSize] = useState<number>(24);

  const grid: GridData | undefined = state?.grid;

  // Calculate dynamic cell size
  useEffect(() => {
    if (!grid || !containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const csX = Math.floor((clientWidth - 48) / grid.width);
    const csY = Math.floor((clientHeight - 48) / grid.height);
    const calculated = Math.max(8, Math.min(36, Math.min(csX, csY)));
    setCellSize(calculated);
  }, [grid?.width, grid?.height]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CELL = cellSize;
    const width = grid.width * CELL;
    const height = grid.height * CELL;

    canvas.width = width;
    canvas.height = height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Deep Minimalist Floor Grid
    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, width, height);

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const isObstacle = grid.cells[y][x] === 1;

        if (isObstacle) {
          // Aesthetic Storage Rack Pod / Obstacle Block
          const rx = x * CELL;
          const ry = y * CELL;
          const pad = CELL > 14 ? 1.5 : 0;

          // Main rack body
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(rx + pad, ry + pad, CELL - pad * 2, CELL - pad * 2);

          // Rack inner accent border & detail lines
          if (CELL > 12) {
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.strokeRect(rx + pad + 0.5, ry + pad + 0.5, CELL - pad * 2 - 1, CELL - pad * 2 - 1);

            // Subtle rack shelf dividers
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.beginPath();
            ctx.moveTo(rx + CELL * 0.2, ry + CELL / 2);
            ctx.lineTo(rx + CELL * 0.8, ry + CELL / 2);
            ctx.stroke();
          }
        } else {
          // Open floor grid cell
          if (CELL > 10) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);

            // Subtle center node dot
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.fillRect(x * CELL + CELL / 2 - 0.5, y * CELL + CELL / 2 - 0.5, 1, 1);
          }
        }
      }
    }

    // 2. Heatmap Overlay Layer
    if (heatOn && state?.heatmap && state.heatmap.length > 0) {
      state.heatmap.forEach(h => {
        const intensity = Math.min(1, h.v * 0.6);
        ctx.fillStyle = `rgba(244, 63, 94, ${intensity})`;
        ctx.fillRect(h.x * CELL, h.y * CELL, CELL, CELL);
      });
    }

    // 3. Proactive Conflict Prediction Points
    if (state?.conflicts && state.conflicts.length > 0) {
      state.conflicts.forEach(cf => {
        const [x, y] = cf.cell;
        const alpha = cf.confidence * 0.85;

        // Glowing collision warning box
        ctx.fillStyle = `rgba(245, 158, 11, ${alpha * 0.35})`;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x * CELL + 1.5, y * CELL + 1.5, CELL - 3, CELL - 3);

        // Warning cross hatch
        if (CELL > 14) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x * CELL + 3, y * CELL + 3);
          ctx.lineTo(x * CELL + CELL - 3, y * CELL + CELL - 3);
          ctx.stroke();
        }
      });
    }

    // 4. Stations Rendering (Pick = Emerald, Drop = Orange)
    (grid.pick_stations || []).forEach(([px, py]) => {
      const st = (state?.stations || []).find(s => s.x === px && s.y === py && s.type === 'pick');
      const cx = px * CELL;
      const cy = py * CELL;

      // Glow fill
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.fillRect(cx, cy, CELL, CELL);

      ctx.fillStyle = '#10b981';
      ctx.fillRect(cx + 1.5, cy + 1.5, CELL - 3, CELL - 3);

      if (CELL > 11) {
        ctx.fillStyle = '#022c22';
        ctx.font = `bold ${Math.max(CELL * 0.4, 9)}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(st ? `${st.current}` : 'P', cx + CELL / 2, cy + CELL / 2);
      }
    });

    (grid.drop_stations || []).forEach(([dx, dy]) => {
      const st = (state?.stations || []).find(s => s.x === dx && s.y === dy && s.type === 'drop');
      const cx = dx * CELL;
      const cy = dy * CELL;

      ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';
      ctx.fillRect(cx, cy, CELL, CELL);

      ctx.fillStyle = '#f97316';
      ctx.fillRect(cx + 1.5, cy + 1.5, CELL - 3, CELL - 3);

      if (CELL > 11) {
        ctx.fillStyle = '#431407';
        ctx.font = `bold ${Math.max(CELL * 0.4, 9)}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(st ? `${st.current}` : 'D', cx + CELL / 2, cy + CELL / 2);
      }
    });

    // 4b. Charging Stations Rendering (Electric Cyan ⚡)
    (grid.charging_stations || []).forEach(([chx, chy]) => {
      const cx = chx * CELL;
      const cy = chy * CELL;

      ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.fillRect(cx, cy, CELL, CELL);

      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(cx + 1.5, cy + 1.5, CELL - 3, CELL - 3);

      if (CELL > 11) {
        ctx.fillStyle = '#083344';
        ctx.font = `bold ${Math.max(CELL * 0.38, 9)}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', cx + CELL / 2, cy + CELL / 2);
      }
    });

    // 5. Robot Dynamic Planned Paths & Target Lines
    if (routeOn && state?.robots) {
      state.robots.forEach(r => {
        if (!r.target || r.state === 'idle' || r.state === 'failed') return;
        const sx = r.x * CELL + CELL / 2;
        const sy = r.y * CELL + CELL / 2;
        const tx = r.target[0] * CELL + CELL / 2;
        const ty = r.target[1] * CELL + CELL / 2;

        // Path trace line
        ctx.beginPath();
        ctx.strokeStyle = r.phase === 'pickup' ? 'rgba(52, 211, 153, 0.4)' : `${r.color}77`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash(r.phase === 'pickup' ? [3, 3] : []);
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);

        // Target station pulse ring
        ctx.beginPath();
        ctx.strokeStyle = r.phase === 'pickup' ? '#34d399' : r.color;
        ctx.lineWidth = 1.5;
        ctx.arc(tx, ty, Math.max(CELL * 0.45, 5), 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // Planned path waypoints
    if (state?.robots) {
      state.robots.forEach(r => {
        if (!r.path || r.path.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = `${r.color}44`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 3]);
        ctx.moveTo(r.path[0][0] * CELL + CELL / 2, r.path[0][1] * CELL + CELL / 2);
        for (let i = 1; i < r.path.length; i++) {
          ctx.lineTo(r.path[i][0] * CELL + CELL / 2, r.path[i][1] * CELL + CELL / 2);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // 6. Robots Rendering (Sleek Autonomous Mobile Robots)
    if (state?.robots) {
      state.robots.forEach(r => {
        const cx = r.x * CELL + CELL / 2;
        const cy = r.y * CELL + CELL / 2;
        const rad = Math.max(CELL * 0.38, 5);

        // Direction Vector (Heading arrow)
        let angle = 0;
        if (r.path && r.path.length > 1) {
          const next = r.path[1];
          angle = Math.atan2(next[1] - r.y, next[0] - r.x);
        }

        // Outer Aura Ring
        if (r.state !== 'failed') {
          ctx.beginPath();
          ctx.arc(cx, cy, rad + 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `${r.color}22`;
          ctx.fill();
          ctx.strokeStyle = r.phase === 'pickup' ? '#34d399' : r.color;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Robot Core Circle
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fillStyle =
          r.state === 'failed'
            ? '#475569'
            : r.state === 'waiting'
            ? `${r.color}aa`
            : r.color;
        ctx.fill();
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Heading Directional Arrow Pointer
        if (r.state === 'moving' && CELL > 12) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(rad * 0.7, 0);
          ctx.lineTo(-rad * 0.4, -rad * 0.4);
          ctx.lineTo(-rad * 0.2, 0);
          ctx.lineTo(-rad * 0.4, rad * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // Robot ID & Battery percentage display
        if (CELL > 11) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(CELL * 0.35, 8)}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(r.battery !== undefined ? `${r.battery}%` : `${r.id}`, cx, cy);
        }

        // Package Carrying Dot / Load Count Indicator
        if (r.carrying > 0 && CELL > 12) {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(cx + rad * 0.7, cy - rad * 0.7, Math.max(CELL * 0.18, 4), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#020617';
          ctx.lineWidth = 1;
          ctx.stroke();

          if (CELL > 16) {
            ctx.fillStyle = '#000000';
            ctx.font = `bold ${Math.max(CELL * 0.25, 7)}px JetBrains Mono, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${r.carrying}`, cx + rad * 0.7, cy - rad * 0.7);
          }
        }

        // Failed X icon
        if (r.state === 'failed' && CELL > 10) {
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - 3.5, cy - 3.5);
          ctx.lineTo(cx + 3.5, cy + 3.5);
          ctx.moveTo(cx + 3.5, cy - 3.5);
          ctx.lineTo(cx - 3.5, cy + 3.5);
          ctx.stroke();
        }
      });
    }

    ctx.restore();
  }, [canvasRef, grid, cellSize, state, heatOn, routeOn]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Click handler for cell blocking
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!blockMode || !grid || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = (e.clientX - rect.left) / scale;
    const clientY = (e.clientY - rect.top) / scale;

    const cellX = Math.floor(clientX / cellSize);
    const cellY = Math.floor(clientY / cellSize);

    if (cellX >= 0 && cellX < grid.width && cellY >= 0 && cellY < grid.height) {
      onBlockCell(cellX, cellY);
    }
  };

  // Dragging / Panning handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (blockMode) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-[#05070c] flex items-center justify-center overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* JOB FINISHED Glowing Top Notification Banner */}
      {state?.job_finished && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-semibold backdrop-blur-xl shadow-2xl shadow-emerald-500/20 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>🎉 JOB FINISHED! All items picked and delivered. Robots parked at Charging Stations.</span>
        </div>
      )}

      {/* Dynamic Background Grid Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

      {/* Floating Canvas Transform Wrapper */}
      <div
        className="transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor: blockMode ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
        }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="rounded-lg border border-slate-800/80 shadow-2xl shadow-black/80"
        />
      </div>

      {/* Floating Canvas Toolbar Controls */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-lg">
        <button
          onClick={() => setScale(s => Math.min(s + 0.2, 3))}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale(s => Math.max(s - 0.2, 0.5))}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Reset Zoom & Pan"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {onClearBlocks && (
          <>
            <div className="h-4 w-px bg-slate-800 mx-1"></div>
            <button
              onClick={onClearBlocks}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-all"
              title="Remove all custom blocked obstacles"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Blocks</span>
            </button>
          </>
        )}

        <div className="h-4 w-px bg-slate-800 mx-1"></div>
        <span className="text-[11px] font-mono text-slate-400 px-1">
          {Math.round(scale * 100)}%
        </span>
      </div>

      {/* Legend Overlay */}
      <div className="absolute top-4 left-4 z-20 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-[11px] backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
          <span className="text-slate-300">Pick Station</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-orange-500"></span>
          <span className="text-slate-300">Drop Station</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-cyan-400 flex items-center justify-center text-[8px] text-black font-bold">⚡</span>
          <span className="text-slate-300">Charging Pad</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-slate-700"></span>
          <span className="text-slate-300">Shelf Block</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
          <span className="text-slate-300">Conflict Point</span>
        </div>
      </div>
    </div>
  );
};
