import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SimulationState, GridData, EmergencyStatus } from '../types/fleet';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  CheckCircle2,
  Siren,
  AlertTriangle,
  RotateCw,
  XCircle,
  ShieldAlert,
  ArrowRight,
  Route,
  X
} from 'lucide-react';

interface WarehouseCanvasProps {
  state: SimulationState | null;
  heatOn: boolean;
  routeOn: boolean;
  blockMode: boolean;
  onBlockCell: (x: number, y: number) => void;
  onFailRobot?: (rid: number) => void;
  onClearBlocks?: () => void;
  onOpenEmergencyModal?: () => void;
  onCancelEmergency?: () => void;
}

export const WarehouseCanvas: React.FC<WarehouseCanvasProps> = ({
  state,
  heatOn,
  routeOn,
  blockMode,
  onBlockCell,
  onClearBlocks,
  onOpenEmergencyModal,
  onCancelEmergency,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cellSize, setCellSize] = useState<number>(24);
  const [jobDismissed, setJobDismissed] = useState<boolean>(false);
  const prevJobFinishedRef = useRef<boolean>(false);

  // Auto-dismiss Job Finished banner after 6 seconds
  useEffect(() => {
    if (state?.job_finished && !prevJobFinishedRef.current) {
      setJobDismissed(false);
      const timer = setTimeout(() => {
        setJobDismissed(true);
      }, 6000);
      return () => clearTimeout(timer);
    } else if (!state?.job_finished) {
      setJobDismissed(false);
    }
    prevJobFinishedRef.current = !!state?.job_finished;
  }, [state?.job_finished]);

  const grid: GridData | undefined = state?.grid;
  const emergency = state?.emergency;

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

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Deep Minimalist Floor Grid
    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, width, height);

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const isObstacle = grid.cells[y][x] === 1;

        if (isObstacle) {
          // Storage Rack Pod / Obstacle Block
          const rx = x * CELL;
          const ry = y * CELL;
          const pad = CELL > 14 ? 1.5 : 0;

          ctx.fillStyle = '#1e293b';
          ctx.fillRect(rx + pad, ry + pad, CELL - pad * 2, CELL - pad * 2);

          if (CELL > 12) {
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.strokeRect(rx + pad + 0.5, ry + pad + 0.5, CELL - pad * 2 - 1, CELL - pad * 2 - 1);

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

    // 3. Dynamic Emergency Corridor Layer (Red / Orange glowing reservation)
    if (emergency && emergency.active && emergency.reservedCells && emergency.reservedCells.length > 0) {
      const now = Date.now();
      const pulse = 0.25 + 0.15 * Math.sin(now * 0.006);

      // 3a. Corridor Base Cells Fill & Borders
      emergency.reservedCells.forEach(([cx, cy]) => {
        const rx = cx * CELL;
        const ry = cy * CELL;

        // Glowing red fill
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.fillRect(rx, ry, CELL, CELL);

        // Crisp red border
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx + 0.5, ry + 0.5, CELL - 1, CELL - 1);
      });

      // 3b. Intersections Highlight (Orange warning crosshatch)
      if (emergency.intersections && emergency.intersections.length > 0) {
        emergency.intersections.forEach(([ix, iy]) => {
          const rx = ix * CELL;
          const ry = iy * CELL;
          ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
          ctx.fillRect(rx, ry, CELL, CELL);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(rx + 1, ry + 1, CELL - 2, CELL - 2);
        });
      }

      // 3c. Corridor Route Flow Line (Bright Red Glow with directional chevrons)
      if (emergency.route && emergency.route.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = Math.max(2.5, CELL * 0.15);
        ctx.setLineDash([CELL * 0.4, CELL * 0.2]);
        ctx.lineDashOffset = -(now * 0.02) % (CELL * 0.6);
        ctx.moveTo(emergency.route[0][0] * CELL + CELL / 2, emergency.route[0][1] * CELL + CELL / 2);
        for (let i = 1; i < emergency.route.length; i++) {
          ctx.lineTo(emergency.route[i][0] * CELL + CELL / 2, emergency.route[i][1] * CELL + CELL / 2);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 4. Emergency Phase Markers: VIP Pickup (Emerald) and VIP Dropoff (Red)
    if (emergency && emergency.active) {
      const now = Date.now();
      const beaconRadius = Math.max(CELL * 0.6, 8) + (Math.sin(now * 0.008) + 1) * (CELL * 0.2);

      // 4a. VIP Pickup Marker
      if (emergency.pickup) {
        const [px, py] = emergency.pickup;
        const pcx = px * CELL + CELL / 2;
        const pcy = py * CELL + CELL / 2;
        const isToPickup = emergency.phase === 'to_pickup';

        if (isToPickup) {
          // Active pickup beacon (pulsing emerald)
          ctx.beginPath();
          ctx.arc(pcx, pcy, beaconRadius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
          ctx.fill();
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Inner crosshair
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(pcx - CELL * 0.35, pcy);
          ctx.lineTo(pcx + CELL * 0.35, pcy);
          ctx.moveTo(pcx, pcy - CELL * 0.35);
          ctx.lineTo(pcx, pcy + CELL * 0.35);
          ctx.stroke();

          if (CELL > 13) {
            ctx.fillStyle = '#10b981';
            ctx.font = `bold ${Math.max(CELL * 0.3, 8)}px JetBrains Mono, monospace`;
            ctx.textAlign = 'center';
            ctx.fillText('PICKUP', pcx, pcy - beaconRadius - 3);
          }
        } else {
          // Pickup fulfilled badge
          ctx.beginPath();
          ctx.arc(pcx, pcy, CELL * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
          ctx.fill();
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // 4b. VIP Dropoff / Destination Marker
      const dropCoords = emergency.dropoff || emergency.destination;
      if (dropCoords) {
        const [dx, dy] = dropCoords;
        const dcx = dx * CELL + CELL / 2;
        const dcy = dy * CELL + CELL / 2;

        // Outer Beacon Ring
        ctx.beginPath();
        ctx.arc(dcx, dcy, beaconRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner Target Crosshair
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(dcx - CELL * 0.35, dcy);
        ctx.lineTo(dcx + CELL * 0.35, dcy);
        ctx.moveTo(dcx, dcy - CELL * 0.35);
        ctx.lineTo(dcx, dcy + CELL * 0.35);
        ctx.stroke();

        if (CELL > 13) {
          ctx.fillStyle = '#ef4444';
          ctx.font = `bold ${Math.max(CELL * 0.3, 8)}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('DROPOFF', dcx, dcy - beaconRadius - 3);
        }
      }
    }

    // 5. Proactive Conflict Prediction Points
    if (state?.conflicts && state.conflicts.length > 0) {
      state.conflicts.forEach(cf => {
        const [x, y] = cf.cell;
        const alpha = cf.confidence * 0.85;

        ctx.fillStyle = `rgba(245, 158, 11, ${alpha * 0.35})`;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x * CELL + 1.5, y * CELL + 1.5, CELL - 3, CELL - 3);

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

    // 6. Stations Rendering (Pick = Emerald, Drop = Orange, Charge = Cyan)
    (grid.pick_stations || []).forEach(([px, py]) => {
      const st = (state?.stations || []).find(s => s.x === px && s.y === py && s.type === 'pick');
      const cx = px * CELL;
      const cy = py * CELL;

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

    // 7. Alternate Rerouted Routes (Blue Overlays) & Normal Paths
    if (routeOn && state?.robots) {
      state.robots.forEach(r => {
        if (!r.path || r.path.length < 2) return;
        const isEmerg = r.isEmergency || (emergency?.active && emergency.robotId === r.id);
        const isRerouted = r.isRerouted;

        ctx.beginPath();
        if (isEmerg) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
        } else if (isRerouted) {
          // Alternate route in distinct blue
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 2]);
        } else {
          ctx.strokeStyle = `${r.color}44`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([2, 3]);
        }

        ctx.moveTo(r.path[0][0] * CELL + CELL / 2, r.path[0][1] * CELL + CELL / 2);
        for (let i = 1; i < r.path.length; i++) {
          ctx.lineTo(r.path[i][0] * CELL + CELL / 2, r.path[i][1] * CELL + CELL / 2);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // 8. Robots Rendering (with Emergency Siren Animation & Yield Indicators)
    if (state?.robots) {
      const now = Date.now();
      const sirenFlash = Math.sin(now * 0.015) > 0; // High frequency siren blink (~5Hz)
      const sirenPulse = (Math.sin(now * 0.009) + 1) / 2; // Pulsing halo radius multiplier

      state.robots.forEach(r => {
        const cx = r.x * CELL + CELL / 2;
        const cy = r.y * CELL + CELL / 2;
        const rad = Math.max(CELL * 0.38, 5);
        const isEmerg = r.isEmergency || (emergency?.active && emergency.robotId === r.id);
        const isYielding = r.isYielding;

        // Heading Direction Vector
        let angle = 0;
        if (r.path && r.path.length > 1) {
          const next = r.path[1];
          angle = Math.atan2(next[1] - r.y, next[0] - r.x);
        }

        // --- EMERGENCY SIREN ANIMATION ---
        if (isEmerg && r.state !== 'failed') {
          // 1. Pulsing Red Halo / Aura Rings
          const haloRad = rad + 3 + sirenPulse * (CELL * 0.6);
          ctx.beginPath();
          ctx.arc(cx, cy, haloRad, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(239, 68, 68, ${0.35 - sirenPulse * 0.25})`;
          ctx.fill();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // 2. Rotating Dual Siren Light Beams
          const sirenAngle = (now * 0.01) % (Math.PI * 2);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(sirenAngle);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, rad * 1.6, -Math.PI / 6, Math.PI / 6);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, rad * 1.6, Math.PI - Math.PI / 6, Math.PI + Math.PI / 6);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
          ctx.fill();
          ctx.restore();

          // 3. Blinking Siren Body (Alternating Bright Red & Crimson)
          ctx.beginPath();
          ctx.arc(cx, cy, rad + 1, 0, Math.PI * 2);
          ctx.fillStyle = sirenFlash ? '#ef4444' : '#991b1b';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Emergency Badge Tag
          if (CELL > 12) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(CELL * 0.35, 8)}px JetBrains Mono, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🚨', cx, cy);
          }
        }
        // --- YIELDING ROBOT INDICATOR (Yellow Outer Ring) ---
        else if (isYielding && r.state !== 'failed') {
          ctx.beginPath();
          ctx.arc(cx, cy, rad + 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(234, 179, 8, 0.3)';
          ctx.fill();
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.fillStyle = `${r.color}bb`;
          ctx.fill();
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          if (CELL > 11) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(CELL * 0.35, 8)}px JetBrains Mono, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${r.battery}%`, cx, cy);
          }
        }
        // --- NORMAL ROBOT RENDERING ---
        else {
          if (r.state !== 'failed') {
            ctx.beginPath();
            ctx.arc(cx, cy, rad + 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `${r.color}22`;
            ctx.fill();
            ctx.strokeStyle = r.phase === 'pickup' ? '#34d399' : r.color;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

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

          if (CELL > 11) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(CELL * 0.35, 8)}px JetBrains Mono, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(r.battery !== undefined ? `${r.battery}%` : `${r.id}`, cx, cy);
          }
        }

        // Direction Arrow Pointer
        if (r.state === 'moving' && CELL > 12 && !isEmerg) {
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

        // Package Carrying Dot
        if (r.carrying > 0 && CELL > 12) {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(cx + rad * 0.7, cy - rad * 0.7, Math.max(CELL * 0.18, 4), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#020617';
          ctx.lineWidth = 1;
          ctx.stroke();
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
  }, [canvasRef, grid, cellSize, state, heatOn, routeOn, emergency]);

  // Continuous animation loop for smooth 60fps siren blinking & halo pulsing
  useEffect(() => {
    let animId: number;
    const loop = () => {
      draw();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [draw]);

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

  // Status mapping helper
  const getStatusBadge = (status?: EmergencyStatus) => {
    switch (status) {
      case 'active':
        return {
          label: 'CORRIDOR ACTIVE',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
          icon: <Siren className="w-3.5 h-3.5 animate-pulse text-rose-400" />,
        };
      case 'planning':
        return {
          label: 'ROUTE PLANNING',
          color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50',
          icon: <Route className="w-3.5 h-3.5 animate-spin text-cyan-400" />,
        };
      case 'awaiting_clearance':
        return {
          label: 'AWAITING CLEARANCE',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
        };
      case 'replanning':
        return {
          label: 'REPLANNING',
          color: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
          icon: <RotateCw className="w-3.5 h-3.5 animate-spin text-orange-400" />,
        };
      case 'completed':
        return {
          label: 'DELIVERY COMPLETED',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
        };
      case 'released':
        return {
          label: 'CORRIDOR RELEASED',
          color: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />,
        };
      case 'failed':
        return {
          label: 'FAILED',
          color: 'bg-rose-950/80 text-rose-400 border-rose-600',
          icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
        };
      default:
        return {
          label: 'INACTIVE',
          color: 'bg-slate-900/80 text-slate-400 border-slate-800',
          icon: <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />,
        };
    }
  };

  const statusBadge = getStatusBadge(emergency?.status);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-[#05070c] flex items-center justify-center overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* JOB FINISHED Notification Banner with Auto-Dismiss & Close Button */}
      {state?.job_finished && !jobDismissed && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-semibold backdrop-blur-xl shadow-2xl shadow-emerald-500/20 animate-fade-in transition-all">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>🎉 JOB FINISHED! All items delivered. Robots parked at Charging Stations.</span>
          <button
            onClick={() => setJobDismissed(true)}
            className="ml-2 p-1 rounded-full hover:bg-emerald-500/30 text-emerald-300 hover:text-white transition-colors"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* COMPACT EMERGENCY CORRIDOR STATUS HUD WIDGET */}
      <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-[#0b0f19]/90 border border-slate-800/90 shadow-2xl backdrop-blur-md">
          {/* Emergency Status Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${statusBadge.color}`}>
            {statusBadge.icon}
            <span>{statusBadge.label}</span>
          </div>

          {/* Real-Time Swarm State Metrics */}
          {emergency?.active && (
            <div className="hidden sm:flex items-center gap-3 px-3 text-[11px] font-mono border-l border-slate-800 text-slate-300">
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <span>{emergency.yieldingRobots?.length || 0}</span>
                <span className="text-slate-400 font-normal">Yielding</span>
              </span>
              <span className="text-cyan-400 font-bold flex items-center gap-1">
                <span>{emergency.reroutedRobots?.length || 0}</span>
                <span className="text-slate-400 font-normal">Rerouted</span>
              </span>
            </div>
          )}

          {/* Quick Action Button */}
          {emergency?.active ? (
            <button
              onClick={onCancelEmergency}
              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold transition-all"
            >
              Release
            </button>
          ) : (
            onOpenEmergencyModal && (
              <button
                onClick={onOpenEmergencyModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/50 text-xs font-mono font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all"
              >
                <Siren className="w-3.5 h-3.5 text-rose-400" />
                <span>Emergency Corridor</span>
              </button>
            )
          )}
        </div>
      </div>

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
      <div className="absolute top-4 left-4 z-20 hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-[11px] backdrop-blur-md">
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
          <span className="w-2.5 h-2.5 rounded bg-rose-600 animate-pulse"></span>
          <span className="text-slate-300">Emergency Corridor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-amber-400"></span>
          <span className="text-slate-300">Yielding Robot</span>
        </div>
      </div>
    </div>
  );
};
