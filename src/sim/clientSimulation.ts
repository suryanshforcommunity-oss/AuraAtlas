import { SimulationState, GridData, RobotData, StationData, HeatmapPoint, ConflictData } from '../types/fleet';
import { loadGridByName, FREE, OBSTACLE, createCustomWarehouseGrid } from './mapLoader';

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

/**
 * A* Pathfinding that strictly respects obstacles and dynamic blocks.
 * If target is blocked, it routes to the closest accessible adjacent free cell.
 * If no route is found, it safely holds position ([start]) — NEVER jumps through obstacles!
 */
export function findPath(
  grid: GridData,
  start: [number, number],
  target: [number, number],
  avoidCells?: Set<string>
): [number, number][] {
  if (start[0] === target[0] && start[1] === target[1]) return [start];

  // Ensure start cell is valid
  let actualStart = start;
  if (grid.cells[start[1]]?.[start[0]] === OBSTACLE) {
    const freeNear = [
      [start[0] + 1, start[1]],
      [start[0] - 1, start[1]],
      [start[0], start[1] + 1],
      [start[0], start[1] - 1],
    ].filter(([x, y]) => x >= 0 && x < grid.width && y >= 0 && y < grid.height && grid.cells[y][x] === FREE) as [number, number][];
    if (freeNear.length > 0) actualStart = freeNear[0];
  }

  // If target cell is an obstacle, find nearest adjacent free cell
  let actualTarget = target;
  if (grid.cells[target[1]]?.[target[0]] === OBSTACLE) {
    const freeNeighbors = [
      [target[0], target[1] - 1],
      [target[0], target[1] + 1],
      [target[0] - 1, target[1]],
      [target[0] + 1, target[1]],
    ].filter(([x, y]) => x >= 0 && x < grid.width && y >= 0 && y < grid.height && grid.cells[y][x] === FREE) as [number, number][];

    if (freeNeighbors.length > 0) {
      actualTarget = freeNeighbors[0];
    } else {
      return [actualStart]; // Target completely surrounded by walls, hold position
    }
  }

  // Priority Queue A* search
  interface QueueItem {
    x: number;
    y: number;
    path: [number, number][];
    cost: number;
    score: number;
  }

  const queue: QueueItem[] = [
    {
      x: actualStart[0],
      y: actualStart[1],
      path: [actualStart],
      cost: 0,
      score: Math.abs(actualStart[0] - actualTarget[0]) + Math.abs(actualStart[1] - actualTarget[1]),
    },
  ];

  const visited = new Map<string, number>();
  visited.set(`${actualStart[0]},${actualStart[1]}`, 0);

  const dirs: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  while (queue.length > 0) {
    // Pop lowest heuristic score
    queue.sort((a, b) => a.score - b.score);
    const curr = queue.shift()!;

    if (curr.x === actualTarget[0] && curr.y === actualTarget[1]) {
      return curr.path;
    }

    for (const [dx, dy] of dirs) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      const key = `${nx},${ny}`;

      // STRICT OBSTACLE CHECK: Cell must be within bounds and completely FREE!
      if (
        nx >= 0 &&
        nx < grid.width &&
        ny >= 0 &&
        ny < grid.height &&
        grid.cells[ny][nx] === FREE &&
        (!avoidCells || !avoidCells.has(key) || (nx === actualTarget[0] && ny === actualTarget[1]))
      ) {
        const nextCost = curr.cost + 1;
        const prevCost = visited.get(key);

        if (prevCost === undefined || nextCost < prevCost) {
          visited.set(key, nextCost);
          const heuristic = Math.abs(nx - actualTarget[0]) + Math.abs(ny - actualTarget[1]);
          queue.push({
            x: nx,
            y: ny,
            path: [...curr.path, [nx, ny]],
            cost: nextCost,
            score: nextCost + heuristic,
          });
        }
      }
    }
  }

  // If no path exists, STAY IN PLACE ([actualStart])! NEVER jump through obstacles!
  return [actualStart];
}

/**
 * Dynamically toggles an obstacle cell and IMMEDIATELY reroutes any robots
 * whose planned paths intersect the blocked cell.
 */
export function toggleObstacleClientSimulation(
  prev: SimulationState,
  x: number,
  y: number
): SimulationState {
  if (!prev.grid) return prev;
  const isNowBlocked = prev.grid.cells[y]?.[x] === FREE;

  // 1. Update grid cell matrix
  const newCells = prev.grid.cells.map((row, ry) =>
    row.map((val, rx) => (rx === x && ry === y ? (isNowBlocked ? OBSTACLE : FREE) : val))
  );

  const updatedGrid: GridData = {
    ...prev.grid,
    cells: newCells,
  };

  const hive = [...prev.hive_mind];
  const events = [...prev.events];
  let replansCount = prev.performance.replans;

  events.unshift(`[${new Date().toLocaleTimeString()}] Cell (${x}, ${y}) ${isNowBlocked ? 'BLOCKED' : 'CLEARED'}`);

  // 2. Real-time dynamic replanning for all affected rovers
  const updatedRobots: RobotData[] = prev.robots.map((r): RobotData => {
    if (r.state === 'failed') return r;

    // Check if robot is currently sitting on the blocked cell
    let currentX = r.x;
    let currentY = r.y;
    if (isNowBlocked && currentX === x && currentY === y) {
      // Find nearest free cell to push the robot safely
      const safe = [
        [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
      ].find(([cx, cy]) => cx >= 0 && cx < updatedGrid.width && cy >= 0 && cy < updatedGrid.height && updatedGrid.cells[cy][cx] === FREE);
      if (safe) {
        currentX = safe[0];
        currentY = safe[1];
      }
    }

    // Check if the robot's upcoming path passes through the toggled cell
    const pathHitsObstacle = r.path.some(([px, py]) => px === x && py === y);
    const pathHasAnyObstacle = r.path.some(([px, py]) => updatedGrid.cells[py]?.[px] === OBSTACLE);

    if (isNowBlocked && (pathHitsObstacle || pathHasAnyObstacle)) {
      // Reroute immediately around the new blockage!
      const newPath = findPath(updatedGrid, [currentX, currentY], r.target || [currentX, currentY]);
      replansCount++;

      if (newPath.length > 1) {
        hive.unshift({
          type: 'detour',
          msg: `Robot #${r.id} dynamically rerouted around obstacle at (${x}, ${y})`,
        });
        return {
          ...r,
          x: currentX,
          y: currentY,
          path: newPath,
          state: 'moving',
          isRerouted: true,
        };
      } else {
        // Path blocked with no detour available right now
        hive.unshift({
          type: 'yield',
          msg: `Robot #${r.id} path blocked at (${x}, ${y}): waiting for obstacle clearance`,
        });
        return {
          ...r,
          x: currentX,
          y: currentY,
          path: [[currentX, currentY]] as [number, number][],
          state: 'waiting',
          isYielding: true,
        };
      }
    } else if (!isNowBlocked && r.state === 'waiting') {
      // If unblocked and robot was waiting, try to resume
      const newPath = findPath(updatedGrid, [currentX, currentY], r.target || [currentX, currentY]);
      if (newPath.length > 1) {
        return {
          ...r,
          x: currentX,
          y: currentY,
          path: newPath,
          state: 'moving',
          isYielding: false,
        };
      }
    }

    return {
      ...r,
      x: currentX,
      y: currentY,
    };
  });

  // 3. Reroute emergency corridor if active and blocked
  let emergency = prev.emergency ? { ...prev.emergency } : undefined;
  if (emergency?.active && isNowBlocked && emergency.destination && emergency.robotId !== null) {
    const hitsCorridor = emergency.reservedCells.some(([cx, cy]) => cx === x && cy === y);
    if (hitsCorridor) {
      const eBot = updatedRobots.find(r => r.id === emergency.robotId);
      if (eBot) {
        const detour = findPath(updatedGrid, [eBot.x, eBot.y], emergency.destination);
        if (detour.length > 1) {
          emergency.route = detour;
          emergency.reservedCells = detour;
          emergency.status = 'active';
          eBot.path = detour;
          eBot.state = 'moving';
          hive.unshift({
            type: 'emergency',
            msg: `🚨 Emergency Corridor dynamically rerouted around obstacle (${x}, ${y})!`,
          });
        }
      }
    }
  }

  return {
    ...prev,
    grid: updatedGrid,
    robots: updatedRobots,
    hive_mind: hive.slice(0, 40),
    events: events.slice(0, 30),
    performance: {
      ...prev.performance,
      replans: replansCount,
    },
    emergency,
  };
}

/**
 * Creates full simulation state for any warehouse map (default 'custom' or any benchmark map)
 */
export function createSimulationStateForMap(mapName = 'custom', numRobots = 10, capacity = 1): SimulationState {
  const grid = loadGridByName(mapName);

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

  const freeCells: [number, number][] = [];
  for (let y = 1; y < grid.height - 1; y++) {
    for (let x = 1; x < grid.width - 1; x++) {
      if (grid.cells[y][x] === FREE) {
        const isStation =
          grid.pick_stations.some(p => p[0] === x && p[1] === y) ||
          grid.drop_stations.some(d => d[0] === x && d[1] === y);
        if (!isStation) {
          freeCells.push([x, y]);
        }
      }
    }
  }

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
      { type: 'auction', msg: `Swarm initialized on ${mapName}. ${numRobots} AGV units active with real-time obstacle avoidance.` },
      { type: 'pickup', msg: `Robot #0 inbound to Pick Station (${grid.pick_stations[0]?.[0]}, ${grid.pick_stations[0]?.[1]})` },
      { type: 'delivery', msg: `Robot #1 routed to Drop Dock (${grid.drop_stations[0]?.[0]}, ${grid.drop_stations[0]?.[1]})` },
    ],
    conflicts: [],
    performance: {
      throughput_100: 28.4,
      avg_delivery: 12.8,
      conflicts: 0,
      replans: 0,
      total_deliveries: 42,
    },
    heatmap,
    events: [`[00:00:01] Map ${mapName} loaded. Real-Time Dynamic Obstacle Avoidance Online.`],
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

export function createDefaultSimulationState(): SimulationState {
  return createSimulationStateForMap('custom', 10, 1);
}

/**
 * Advances the simulation by 1 tick with STRICT obstacle avoidance and
 * collision prevention. Rovers NEVER pass through obstacles!
 */
export function stepClientSimulation(prev: SimulationState): SimulationState {
  if (!prev.grid) return prev;
  const grid = prev.grid;
  const tick = prev.tick + 1;

  let totalDeliveries = prev.performance.total_deliveries;
  let totalPickStock = prev.total_pick_stock ?? 150;
  let replansCount = prev.performance.replans;
  const hive = [...prev.hive_mind];
  const emergency = prev.emergency ? { ...prev.emergency } : undefined;
  const conflicts: ConflictData[] = [];

  // Track claimed positions for this tick to prevent robot-to-robot collisions
  const claimedCells = new Set<string>();
  const robotNextPositions = new Map<number, [number, number]>();

  // First pass: verify and replan any robot whose path contains ANY obstacle
  const preparedRobots: RobotData[] = prev.robots.map((r): RobotData => {
    if (r.state === 'failed') {
      claimedCells.add(`${r.x},${r.y}`);
      return r;
    }

    const currentPos: [number, number] = [r.x, r.y];

    // 1. Is any cell in the robot's upcoming path an obstacle?
    const hasObstacleInPath = r.path.some(([px, py]) => grid.cells[py]?.[px] === OBSTACLE);

    if (hasObstacleInPath || r.path.length <= 1) {
      if (r.target) {
        const newPath = findPath(grid, currentPos, r.target);
        if (newPath.length > 1) {
          replansCount++;
          return {
            ...r,
            path: newPath,
            state: 'moving',
            isRerouted: true,
          };
        } else {
          // Path completely blocked right now — robot waits safely!
          return {
            ...r,
            path: [currentPos] as [number, number][],
            state: 'waiting',
            isYielding: true,
          };
        }
      }
    }

    return r;
  });

  // Second pass: step each robot safely with collision and obstacle checks
  const updatedRobots: RobotData[] = preparedRobots.map((r): RobotData => {
    if (r.state === 'failed') return r;

    const newBattery = Math.round(Math.max(15, r.battery - 0.05) * 10) / 10;
    const currentPos: [number, number] = [r.x, r.y];

    // Priority Emergency Robot
    if (emergency?.active && emergency.robotId === r.id) {
      if (r.path.length > 1) {
        const nextCell = r.path[1];
        // Ensure next cell is NOT an obstacle
        if (grid.cells[nextCell[1]]?.[nextCell[0]] !== OBSTACLE) {
          claimedCells.add(`${nextCell[0]},${nextCell[1]}`);
          return {
            ...r,
            x: nextCell[0],
            y: nextCell[1],
            path: r.path.slice(1),
            battery: newBattery,
            isEmergency: true,
          };
        }
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
      const nextKey = `${nextCell[0]},${nextCell[1]}`;

      // CRITICAL CHECK 1: Next cell must NEVER be an obstacle!
      if (grid.cells[nextCell[1]]?.[nextCell[0]] === OBSTACLE) {
        // Immediate detour!
        const detour = findPath(grid, currentPos, r.target || currentPos);
        replansCount++;
        if (detour.length > 1 && grid.cells[detour[1][1]]?.[detour[1][0]] !== OBSTACLE) {
          const detourCell = detour[1];
          claimedCells.add(`${detourCell[0]},${detourCell[1]}`);
          return {
            ...r,
            x: detourCell[0],
            y: detourCell[1],
            path: detour.slice(1),
            state: 'moving',
            battery: newBattery,
            isRerouted: true,
          };
        } else {
          // Detour blocked, hold position
          claimedCells.add(`${r.x},${r.y}`);
          return {
            ...r,
            path: [currentPos] as [number, number][],
            state: 'waiting',
            isYielding: true,
            battery: newBattery,
          };
        }
      }

      // CRITICAL CHECK 2: Robot-to-Robot collision prevention
      if (claimedCells.has(nextKey)) {
        // Cell already claimed by another robot in this tick — yield for 1 tick!
        claimedCells.add(`${r.x},${r.y}`);
        conflicts.push({
          robot_a: r.id,
          robot_b: -1,
          cell: nextCell,
          ticks_away: 1,
          type: 'vertex',
          confidence: 0.95,
        });
        return {
          ...r,
          state: 'waiting',
          isYielding: true,
          battery: newBattery,
        };
      }

      // Safe to step!
      claimedCells.add(nextKey);
      robotNextPositions.set(r.id, nextCell);

      return {
        ...r,
        x: nextCell[0],
        y: nextCell[1],
        path: r.path.slice(1),
        state: 'moving',
        battery: newBattery,
        isYielding: false,
      };
    } else {
      // Reached destination, toggle phase and assign next task
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
      claimedCells.add(`${r.x},${r.y}`);

      return {
        ...r,
        phase: newPhase,
        target: nextTarget,
        carrying: newPhase === 'dropoff' ? 1 : 0,
        done: r.done + (newPhase === 'pickup' ? 1 : 0),
        path: newPath,
        state: newPath.length > 1 ? 'moving' : 'idle',
        battery: newBattery,
      };
    }
  });

  return {
    ...prev,
    tick,
    total_pick_stock: totalPickStock,
    robots: updatedRobots,
    hive_mind: hive.slice(0, 35),
    conflicts,
    performance: {
      ...prev.performance,
      total_deliveries: totalDeliveries,
      throughput_100: Math.round((22 + (totalDeliveries % 18)) * 10) / 10,
      replans: replansCount,
    },
    metrics: {
      ...prev.metrics,
      throughput: totalDeliveries,
      active: updatedRobots.filter(r => r.state === 'moving').length,
      idle: updatedRobots.filter(r => r.state === 'idle' || r.state === 'waiting').length,
      failed: updatedRobots.filter(r => r.state === 'failed').length,
    },
    emergency,
  };
}
