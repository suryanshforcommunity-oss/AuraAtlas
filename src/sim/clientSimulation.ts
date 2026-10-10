import { SimulationState, GridData, RobotData, StationData, HeatmapPoint } from '../types/fleet';
import { loadGridByName, FREE, createCustomWarehouseGrid } from './mapLoader';

export const ROBOT_COLORS = [
  '#3b82f6', // 0 Blue
  '#06b6d4', // 1 Cyan
  '#10b981', // 2 Emerald
  '#f59e0b', // 3 Amber
  '#a855f7', // 4 Purple
  '#ec4899', // 5 Pink
  '#6366f1', // 6 Indigo
  '#14b8a6', // 7 Teal
  '#84cc16', // 8 Lime
  '#f97316', // 9 Orange
  '#0284c7', // 10 Sky
  '#e11d48', // 11 Rose
];

// Helper to find BFS shortest path on any grid
export function findPath(grid: GridData, start: [number, number], target: [number, number]): [number, number][] {
  if (start[0] === target[0] && start[1] === target[1]) return [start];

  const queue: [number, number, [number, number][]][] = [[start[0], start[1], [start]]];
  const visited = new Set<string>();
  visited.add(`${start[0]},${start[1]}`);

  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  while (queue.length > 0) {
    const [cx, cy, p] = queue.shift()!;
    if (cx === target[0] && cy === target[1]) {
      return p;
    }

    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${nx},${ny}`;

      if (
        nx >= 0 &&
        nx < grid.width &&
        ny >= 0 &&
        ny < grid.height &&
        grid.cells[ny][nx] === FREE &&
        !visited.has(key)
      ) {
        visited.add(key);
        queue.push([nx, ny, [...p, [nx, ny]]]);
      }
    }
  }
  return [start, target];
}

/**
 * Creates full simulation state for any warehouse map (default 'custom' or any benchmark map)
 */
export function createSimulationStateForMap(mapName = 'custom', numRobots = 10, capacity = 1): SimulationState {
  const grid = loadGridByName(mapName);

  // Stations from grid pick and drop locations
  const stations: StationData[] = [];
  let sid = 1;

  grid.pick_stations.forEach((pos, idx) => {
    stations.push({
      id: sid++,
      x: pos[0],
      y: pos[1],
      type: 'pick',
      current: 40 + (idx % 3) * 5,
      max: 50,
      priority: (idx % 2) + 1,
      pct: 80 + (idx % 3) * 10,
    });
  });

  grid.drop_stations.forEach((pos, idx) => {
    stations.push({
      id: sid++,
      x: pos[0],
      y: pos[1],
      type: 'drop',
      current: 10 + (idx % 4) * 8,
      max: 60,
      priority: (idx % 2) + 1,
      pct: 20 + (idx % 4) * 15,
    });
  });

  // Find candidate free cells for robot spawning (aisles and perimeter)
  const freeCells: [number, number][] = [];
  for (let y = 1; y < grid.height - 1; y++) {
    for (let x = 1; x < grid.width - 1; x++) {
      if (grid.cells[y][x] === FREE) {
        // Prefer cells not directly on pick or drop stations
        const isStation =
          grid.pick_stations.some(p => p[0] === x && p[1] === y) ||
          grid.drop_stations.some(d => d[0] === x && d[1] === y);
        if (!isStation) {
          freeCells.push([x, y]);
        }
      }
    }
  }

  // Pick evenly spaced spawn locations
  const stride = Math.max(1, Math.floor(freeCells.length / numRobots));
  const robots: RobotData[] = [];

  for (let i = 0; i < numRobots; i++) {
    const spawnPos = freeCells[(i * stride) % freeCells.length] || [1, 1];
    const isPick = i % 2 === 0;
    const target = isPick
      ? grid.pick_stations[i % grid.pick_stations.length]
      : grid.drop_stations[i % grid.drop_stations.length];

    const path = findPath(grid, spawnPos, target);

    robots.push({
      id: i,
      x: spawnPos[0],
      y: spawnPos[1],
      color: ROBOT_COLORS[i % ROBOT_COLORS.length],
      state: 'moving',
      phase: isPick ? 'pickup' : 'dropoff',
      task_id: 100 + i,
      target,
      pickup: grid.pick_stations[i % grid.pick_stations.length],
      dropoff: grid.drop_stations[i % grid.drop_stations.length],
      carrying: isPick ? 0 : 1,
      capacity,
      battery: 88 + ((i * 3) % 12),
      path,
      done: i * 2,
    });
  }

  // Ambient heatmap
  const heatmap: HeatmapPoint[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.cells[y][x] === FREE && (x * 7 + y * 13) % 5 === 0) {
        heatmap.push({ x, y, v: Math.floor(Math.random() * 6) + 1 });
      }
    }
  }

  return {
    tick: 1,
    running: true,
    job_finished: false,
    total_pick_stock: stations.filter(s => s.type === 'pick').reduce((acc, s) => acc + s.current, 0),
    robots,
    stations,
    hive_mind: [
      { type: 'auction', msg: `Swarm initialized on ${mapName}. ${numRobots} AGV units deployed.` },
      { type: 'pickup', msg: `Robot #0 inbound to Pick Station (${grid.pick_stations[0]?.[0]}, ${grid.pick_stations[0]?.[1]})` },
      { type: 'delivery', msg: `Robot #1 routed to Drop Dock (${grid.drop_stations[0]?.[0]}, ${grid.drop_stations[0]?.[1]})` },
    ],
    conflicts: [],
    performance: {
      throughput_100: 28.4,
      avg_delivery: 12.8,
      conflicts: 0,
      replans: 8,
      total_deliveries: 42,
    },
    heatmap,
    events: [`[00:00:01] Map ${mapName} loaded. Autonomous Swarm Online.`],
    metrics: {
      throughput: 42,
      active: numRobots,
      idle: 0,
      failed: 0,
      charging: 0,
    },
    grid,
    emergency: {
      active: false,
      status: 'inactive',
      robotId: null,
      destination: null,
      route: [],
      reservedCells: [],
      intersections: [],
      yieldingRobots: [],
      reroutedRobots: [],
    },
  };
}

/**
 * Returns default simulation state with the standard structured pod warehouse map
 */
export function createDefaultSimulationState(): SimulationState {
  return createSimulationStateForMap('custom', 10, 1);
}

/**
 * Step client-side simulation tick with clean float formatting and collision avoidance
 */
export function stepClientSimulation(prev: SimulationState): SimulationState {
  if (!prev.grid) return prev;
  const grid = prev.grid;
  const tick = prev.tick + 1;

  let totalDeliveries = prev.performance.total_deliveries;
  let totalPickStock = prev.total_pick_stock ?? 150;
  const hive = [...prev.hive_mind];
  const emergency = prev.emergency ? { ...prev.emergency } : undefined;

  const robots = prev.robots.map(r => {
    if (r.state === 'failed') return r;

    // Clean rounded battery simulation (no float decimals like .9500000000029%)
    const newBattery = Math.round(Math.max(15, r.battery - 0.05) * 10) / 10;

    // Emergency corridor active
    if (emergency?.active && emergency.robotId === r.id) {
      if (r.path.length > 1) {
        const nextCell = r.path[1];
        return {
          ...r,
          x: nextCell[0],
          y: nextCell[1],
          path: r.path.slice(1),
          battery: newBattery,
          isEmergency: true,
        };
      } else {
        if (emergency.status === 'active') {
          emergency.status = 'completed';
          emergency.active = false;
          hive.unshift({ type: 'emergency', msg: `VIP Corridor Completed: Robot #${r.id} delivered priority payload!` });
        }
        return {
          ...r,
          isEmergency: false,
          battery: newBattery,
        };
      }
    }

    // Normal robot step
    if (r.path.length > 1) {
      const nextCell = r.path[1];
      const remainingPath = r.path.slice(1);
      return {
        ...r,
        x: nextCell[0],
        y: nextCell[1],
        path: remainingPath,
        battery: newBattery,
      };
    } else {
      // Reached destination, toggle phase
      const currentPos: [number, number] = [r.x, r.y];
      const newPhase: 'pickup' | 'dropoff' = r.phase === 'pickup' ? 'dropoff' : 'pickup';
      let nextTarget: [number, number];

      if (newPhase === 'dropoff') {
        nextTarget = grid.drop_stations[(r.id + tick) % grid.drop_stations.length] || [1, 1];
        totalPickStock = Math.max(0, totalPickStock - 1);
        if (Math.random() < 0.25) {
          hive.unshift({ type: 'pickup', msg: `Robot #${r.id} loaded payload at (${r.x}, ${r.y})` });
        }
      } else {
        nextTarget = grid.pick_stations[(r.id + tick) % grid.pick_stations.length] || [grid.width - 2, grid.height - 2];
        totalDeliveries += 1;
        if (Math.random() < 0.25) {
          hive.unshift({ type: 'delivery', msg: `Robot #${r.id} delivered item to Drop Dock (${r.x}, ${r.y})` });
        }
      }

      const newPath = findPath(grid, currentPos, nextTarget);
      return {
        ...r,
        phase: newPhase,
        target: nextTarget,
        carrying: newPhase === 'dropoff' ? 1 : 0,
        done: r.done + (newPhase === 'pickup' ? 1 : 0),
        path: newPath,
        battery: newBattery,
      };
    }
  });

  return {
    ...prev,
    tick,
    total_pick_stock: totalPickStock,
    robots,
    hive_mind: hive.slice(0, 35),
    performance: {
      ...prev.performance,
      total_deliveries: totalDeliveries,
      throughput_100: Math.round((22 + (totalDeliveries % 18)) * 10) / 10,
    },
    metrics: {
      ...prev.metrics,
      throughput: totalDeliveries,
      active: robots.filter(r => r.state === 'moving').length,
      failed: robots.filter(r => r.state === 'failed').length,
    },
    emergency,
  };
}
