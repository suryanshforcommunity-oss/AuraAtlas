import { SimulationState, GridData, RobotData, StationData, EmergencyCorridorData, HeatmapPoint } from '../types/fleet';

// Generate default warehouse layout (10 columns x 20 rows)
export function createDefaultGrid(): GridData {
  const width = 10;
  const height = 20;
  const cells: number[][] = [];

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      // Create shelf racks with aisles
      const isShelf = (x === 2 || x === 3 || x === 6 || x === 7) && y >= 3 && y <= 16 && y % 3 !== 0;
      row.push(isShelf ? 1 : 0);
    }
    cells.push(row);
  }

  const pick_stations: [number, number][] = [
    [0, 1],
    [9, 1],
    [0, 18],
    [9, 18],
  ];

  const drop_stations: [number, number][] = [
    [1, 0],
    [8, 0],
    [1, 19],
    [8, 19],
  ];

  const charging_stations: [number, number][] = [
    [4, 0],
    [5, 0],
  ];

  return {
    width,
    height,
    cells,
    pick_stations,
    drop_stations,
    charging_stations,
  };
}

const ROBOT_COLORS = [
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
];

// Helper to find simple BFS path between two points
function findPath(grid: GridData, start: [number, number], target: [number, number]): [number, number][] {
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
        grid.cells[ny][nx] === 0 &&
        !visited.has(key)
      ) {
        visited.add(key);
        queue.push([nx, ny, [...p, [nx, ny]]]);
      }
    }
  }
  return [start, target];
}

export function createDefaultSimulationState(): SimulationState {
  const grid = createDefaultGrid();

  const stations: StationData[] = [
    { id: 1, x: 0, y: 1, type: 'pick', current: 48, max: 50, priority: 1, pct: 96 },
    { id: 2, x: 9, y: 1, type: 'pick', current: 36, max: 50, priority: 2, pct: 72 },
    { id: 3, x: 0, y: 18, type: 'pick', current: 42, max: 50, priority: 1, pct: 84 },
    { id: 4, x: 9, y: 18, type: 'pick', current: 28, max: 50, priority: 2, pct: 56 },
    { id: 5, x: 1, y: 0, type: 'drop', current: 12, max: 60, priority: 1, pct: 20 },
    { id: 6, x: 8, y: 0, type: 'drop', current: 24, max: 60, priority: 1, pct: 40 },
    { id: 7, x: 1, y: 19, type: 'drop', current: 18, max: 60, priority: 2, pct: 30 },
    { id: 8, x: 8, y: 19, type: 'drop', current: 30, max: 60, priority: 1, pct: 50 },
  ];

  const spawnPoints: [number, number][] = [
    [1, 2], [4, 2], [8, 2],
    [1, 8], [4, 8], [8, 8],
    [1, 14], [5, 14], [8, 14],
    [4, 18],
  ];

  const robots: RobotData[] = spawnPoints.map((pt, idx) => {
    const isPick = idx % 2 === 0;
    const target = isPick ? grid.pick_stations[idx % grid.pick_stations.length] : grid.drop_stations[idx % grid.drop_stations.length];
    const path = findPath(grid, pt, target);

    return {
      id: idx,
      x: pt[0],
      y: pt[1],
      color: ROBOT_COLORS[idx % ROBOT_COLORS.length],
      state: 'moving',
      phase: isPick ? 'pickup' : 'dropoff',
      task_id: 100 + idx,
      target,
      pickup: grid.pick_stations[idx % grid.pick_stations.length],
      dropoff: grid.drop_stations[idx % grid.drop_stations.length],
      carrying: isPick ? 0 : 1,
      capacity: 1,
      battery: 85 + (idx * 3) % 15,
      path,
      done: idx * 3,
    };
  });

  const heatmap: HeatmapPoint[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.cells[y][x] === 0) {
        heatmap.push({ x, y, v: Math.floor(Math.random() * 8) });
      }
    }
  }

  return {
    tick: 1,
    running: true,
    job_finished: false,
    total_pick_stock: 154,
    robots,
    stations,
    hive_mind: [
      { type: 'auction', msg: 'System initialized. 10 AGV units active.' },
      { type: 'pickup', msg: 'Robot #0 inbound to Pick Station #1' },
      { type: 'delivery', msg: 'Robot #1 completed dropoff at Station #5' },
    ],
    conflicts: [],
    performance: {
      throughput_100: 24.5,
      avg_delivery: 14.2,
      conflicts: 0,
      replans: 12,
      total_deliveries: 48,
    },
    heatmap,
    events: ['[00:00:01] Autonomous Swarm Orchestrator Online.'],
    metrics: {
      throughput: 48,
      active: 10,
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

// Client-side step simulator
export function stepClientSimulation(prev: SimulationState): SimulationState {
  if (!prev.grid) return prev;
  const grid = prev.grid;
  const tick = prev.tick + 1;

  let totalDeliveries = prev.performance.total_deliveries;
  let totalPickStock = prev.total_pick_stock ?? 154;
  const hive = [...prev.hive_mind];
  const emergency = prev.emergency ? { ...prev.emergency } : undefined;

  const robots = prev.robots.map(r => {
    if (r.state === 'failed') return r;

    // Battery simulation
    const newBattery = Math.max(15, r.battery - 0.05);

    // If emergency robot
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
        // Emergency delivered
        if (emergency.status === 'active') {
          emergency.status = 'completed';
          emergency.active = false;
          hive.unshift({ type: 'emergency', msg: `VIP Delivery Complete by Robot #${r.id}!` });
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
      // Reached destination! Switch phase
      const currentPos: [number, number] = [r.x, r.y];
      let newPhase: 'pickup' | 'dropoff' = r.phase === 'pickup' ? 'dropoff' : 'pickup';
      let nextTarget: [number, number];

      if (newPhase === 'dropoff') {
        // Picked item, target drop station
        nextTarget = grid.drop_stations[(r.id + tick) % grid.drop_stations.length];
        totalPickStock = Math.max(0, totalPickStock - 1);
        if (Math.random() < 0.2) {
          hive.unshift({ type: 'pickup', msg: `Robot #${r.id} loaded payload at (${r.x}, ${r.y})` });
        }
      } else {
        // Dropped item, target pick station
        nextTarget = grid.pick_stations[(r.id + tick) % grid.pick_stations.length];
        totalDeliveries += 1;
        if (Math.random() < 0.2) {
          hive.unshift({ type: 'delivery', msg: `Robot #${r.id} completed delivery at (${r.x}, ${r.y})` });
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
    hive_mind: hive.slice(0, 40),
    performance: {
      ...prev.performance,
      total_deliveries: totalDeliveries,
      throughput_100: parseFloat((20 + (totalDeliveries % 15)).toFixed(1)),
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
