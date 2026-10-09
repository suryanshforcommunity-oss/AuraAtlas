import { Grid, createWarehouse, GridDict, autoChargingStations } from './Grid';
import { ReservationTable } from './Reservation';
import { Robot, Task, State, RobotDict } from './Robot';
import { Station, StationDict } from './Station';
import { pibtStep, HiveMessage } from './PIBT';
import { predictConflicts, ConflictPrediction } from './Predictor';
import { PerformanceTracker, PerformanceDict, HeatmapPoint } from './PerformanceTracker';
import { gridAStar, spaceTimeAStar } from './AStar';

export type EmergencyStatus =
  | 'inactive'
  | 'planning'
  | 'awaiting_clearance'
  | 'active'
  | 'replanning'
  | 'completed'
  | 'released'
  | 'failed';

export interface EmergencyCorridorState {
  active: boolean;
  status: EmergencyStatus;
  robotId: number | null;
  destination: [number, number] | null;
  pickup: [number, number] | null;
  dropoff: [number, number] | null;
  phase: 'to_pickup' | 'to_dropoff' | 'delivered' | null;
  route: [number, number][];
  fullRoute?: [number, number][];
  reservedCells: [number, number][];
  intersections: [number, number][];
  yieldingRobots: number[];
  reroutedRobots: number[];
  message?: string;
  startTick?: number;
}

export interface SimulatorState {
  tick: number;
  running: boolean;
  job_finished: boolean;
  total_pick_stock: number;
  robots: RobotDict[];
  stations: StationDict[];
  hive_mind: HiveMessage[];
  conflicts: ConflictPrediction[];
  performance: PerformanceDict;
  heatmap: HeatmapPoint[];
  events: string[];
  metrics: {
    throughput: number;
    active: number;
    idle: number;
    failed: number;
    charging: number;
  };
  grid?: GridDict;
  emergency: EmergencyCorridorState;
}

export class Simulator {
  grid: Grid;
  res: ReservationTable;
  robots: Robot[] = [];
  pending: Task[] = [];
  stations: Station[] = [];
  tick = 0;
  running = false;
  tickDelay = 300; // ms
  events: string[] = [];
  hiveMind: HiveMessage[] = [];
  perf: PerformanceTracker;
  robotCapacity: number;
  jobFinished = false;
  jobFinishedAnnounced = false;

  emergency: EmergencyCorridorState = {
    active: false,
    status: 'inactive',
    robotId: null,
    destination: null,
    pickup: null,
    dropoff: null,
    phase: null,
    route: [],
    reservedCells: [],
    intersections: [],
    yieldingRobots: [],
    reroutedRobots: [],
  };

  private intervalId: NodeJS.Timeout | null = null;
  private broadcastFn: ((state: SimulatorState) => void) | null = null;

  constructor(grid?: Grid, numRobots = 5, robotCapacity = 1) {
    this.grid = grid || createWarehouse();
    this.res = new ReservationTable();
    this.perf = new PerformanceTracker();
    this.robotCapacity = robotCapacity;

    Station.resetCounter();
    Task.resetCounter();
    this.initStations();
    this.spawnRobots(numRobots);
  }

  private initStations(): void {
    this.stations = [];
    for (const pos of this.grid.pick_stations) {
      this.stations.push(new Station(pos[0], pos[1], 'pick', 12));
    }
    for (const pos of this.grid.drop_stations) {
      this.stations.push(new Station(pos[0], pos[1], 'drop', 99));
    }
  }

  private stationAt(pos: [number, number]): Station | null {
    return this.stations.find(s => s.x === pos[0] && s.y === pos[1]) || null;
  }

  private spawnRobots(n: number): void {
    this.grid.charging_stations = autoChargingStations(this.grid, n);
    const pads = this.grid.charging_stations;

    this.robots = [];
    for (let i = 0; i < n; i++) {
      const pad = pads[i % pads.length];
      const r = new Robot(i, pad, this.robotCapacity);
      r.battery = 100;
      this.robots.push(r);
      this.res.claim(pad[0], pad[1], 0, i);
    }
  }

  private findIntersections(route: [number, number][]): [number, number][] {
    const intersections: [number, number][] = [];
    for (const [x, y] of route) {
      const nbrs = this.grid.getNeighbors(x, y);
      if (nbrs.length >= 3) {
        intersections.push([x, y]);
      }
    }
    return intersections;
  }

  previewEmergencyCorridor(
    robotId: number,
    pickup: [number, number],
    dropoff?: [number, number]
  ): {
    ok: boolean;
    route?: [number, number][];
    fullRoute?: [number, number][];
    reservedCells?: [number, number][];
    intersections?: [number, number][];
    error?: string;
  } {
    const robot = this.robots.find(r => r.id === robotId);
    if (!robot) return { ok: false, error: `Robot ${robotId} not found` };
    if (!this.grid.isFree(pickup[0], pickup[1])) {
      return { ok: false, error: `Pickup location (${pickup[0]},${pickup[1]}) is blocked by an obstacle` };
    }

    // Route 1: Robot to Pickup
    const path1 = gridAStar(this.grid, [robot.x, robot.y], pickup);
    if (!path1 || path1.length === 0) {
      return { ok: false, error: `No obstacle-free route found to Pickup (${pickup[0]},${pickup[1]})` };
    }

    let fullRoute = [...path1];

    // Route 2: Pickup to Dropoff (if dropoff provided)
    if (dropoff) {
      if (!this.grid.isFree(dropoff[0], dropoff[1])) {
        return { ok: false, error: `Dropoff location (${dropoff[0]},${dropoff[1]}) is blocked by an obstacle` };
      }
      const path2 = gridAStar(this.grid, pickup, dropoff);
      if (!path2 || path2.length === 0) {
        return { ok: false, error: `No obstacle-free route found between Pickup and Dropoff (${dropoff[0]},${dropoff[1]})` };
      }
      fullRoute = [...path1, ...path2.slice(1)];
    }

    const intersections = this.findIntersections(fullRoute);
    return {
      ok: true,
      route: path1,
      fullRoute,
      reservedCells: fullRoute,
      intersections,
    };
  }

  activateEmergencyCorridor(
    robotId: number,
    pickup: [number, number],
    dropoff?: [number, number]
  ): { ok: boolean; error?: string } {
    const robot = this.robots.find(r => r.id === robotId);
    if (!robot) return { ok: false, error: `Robot ${robotId} not found` };
    if (robot.state === State.FAILED) return { ok: false, error: `Robot ${robotId} is in failed state` };

    const effectiveDropoff = dropoff || pickup;

    // Route 1: Robot -> Pickup
    const path1 = gridAStar(this.grid, [robot.x, robot.y], pickup);
    if (!path1 || path1.length === 0) {
      this.emergency = {
        active: false,
        status: 'failed',
        robotId,
        destination: pickup,
        pickup,
        dropoff: effectiveDropoff,
        phase: null,
        route: [],
        reservedCells: [],
        intersections: [],
        yieldingRobots: [],
        reroutedRobots: [],
        message: 'No safe corridor route found to pickup',
      };
      this.events.push(`❌ EMERGENCY CORRIDOR FAILED: No path for R${robotId} to Pickup (${pickup[0]},${pickup[1]})`);
      return { ok: false, error: 'No safe route found to pickup location' };
    }

    // Route 2: Pickup -> Dropoff
    const path2 = gridAStar(this.grid, pickup, effectiveDropoff);
    if (!path2 || path2.length === 0) {
      return { ok: false, error: 'No safe route found from pickup to dropoff location' };
    }

    const fullRoute = [...path1, ...path2.slice(1)];
    const intersections = this.findIntersections(fullRoute);
    const reservedCells = [...fullRoute];
    const reservedSet = new Set(reservedCells.map(c => `${c[0]},${c[1]}`));

    // Reset previous emergency states & unflag robots
    for (const r of this.robots) {
      r.isEmergency = false;
      r.isYielding = false;
      r.isRerouted = false;
    }

    // Set emergency robot properties
    robot.isEmergency = true;
    robot.path = [...path1];
    robot.pathIdx = 0;
    robot.state = State.MOVING;
    robot.chargeTarget = null;
    robot.isCharging = false;
    robot.carrying = 0; // Starts empty to collect payload at pickup

    // Detect yielding and rerouted normal robots
    const yieldingRobots: number[] = [];
    const reroutedRobots: number[] = [];

    for (const r of this.robots) {
      if (r.id === robotId || r.state === State.FAILED) continue;

      if (reservedSet.has(`${r.x},${r.y}`)) {
        r.isYielding = true;
        yieldingRobots.push(r.id);
      }

      const pathOverlap = r.path.slice(r.pathIdx).some(p => reservedSet.has(`${p[0]},${p[1]}`));
      if (pathOverlap) {
        r.isRerouted = true;
        reroutedRobots.push(r.id);
        if (r.task) {
          const altPath = spaceTimeAStar(this.grid, [r.x, r.y], r.task.goal, this.res, r.id, this.tick, 200, this.robots, reservedSet);
          if (altPath && altPath.length > 0) {
            r.path = altPath;
            r.pathIdx = 0;
          }
        } else if (r.chargeTarget) {
          const altPath = spaceTimeAStar(this.grid, [r.x, r.y], r.chargeTarget, this.res, r.id, this.tick, 200, this.robots, reservedSet);
          if (altPath && altPath.length > 0) {
            r.path = altPath;
            r.pathIdx = 0;
          }
        }
      }
    }

    this.jobFinished = false;
    this.jobFinishedAnnounced = false;

    this.emergency = {
      active: true,
      status: 'active',
      robotId,
      destination: pickup,
      pickup,
      dropoff: effectiveDropoff,
      phase: 'to_pickup',
      route: path1,
      fullRoute,
      reservedCells,
      intersections,
      yieldingRobots,
      reroutedRobots,
      startTick: this.tick,
      message: `Emergency Corridor Active: R${robotId} en route to Pickup (${pickup[0]},${pickup[1]}) → Dropoff (${effectiveDropoff[0]},${effectiveDropoff[1]})`,
    };

    this.events.push(`🚨 EMERGENCY CORRIDOR ACTIVATED: R${robotId} → Pickup (${pickup[0]},${pickup[1]}) → Dropoff (${effectiveDropoff[0]},${effectiveDropoff[1]})`);
    this.hiveMind.unshift({
      type: 'emergency',
      msg: `🚨 EMERGENCY ORDER: R${robotId} dispatched to Pickup (${pickup[0]},${pickup[1]}) → Dropoff (${effectiveDropoff[0]},${effectiveDropoff[1]}). Swarm yielding.`,
    });

    return { ok: true };
  }

  cancelEmergencyCorridor(): void {
    if (this.emergency.robotId !== null) {
      const robot = this.robots.find(r => r.id === this.emergency.robotId);
      if (robot) {
        robot.isEmergency = false;
        robot.carrying = 0;
      }
    }

    for (const r of this.robots) {
      r.isEmergency = false;
      r.isYielding = false;
      r.isRerouted = false;
      if (r.state === State.WAITING && (r.task || r.chargeTarget)) {
        r.replan(this.grid, this.res, this.tick, this.robots);
      }
    }

    this.emergency = {
      active: false,
      status: 'released',
      robotId: null,
      destination: null,
      pickup: null,
      dropoff: null,
      phase: null,
      route: [],
      reservedCells: [],
      intersections: [],
      yieldingRobots: [],
      reroutedRobots: [],
      message: 'Emergency Corridor Released',
    };

    this.events.push('🚨 Emergency Corridor Deactivated & Released');
    this.hiveMind.unshift({
      type: 'emergency',
      msg: '🚨 Emergency Corridor cleared. Normal swarm traffic resumed.',
    });
  }

  private newTask(priority = 1, requestedQty = 1): Task | null {
    const picks = this.stations.filter(s => s.type === 'pick' && s.canPickup(1));
    const drops = this.stations.filter(s => s.type === 'drop' && s.canDrop(1));
    if (picks.length === 0 || drops.length === 0) return null;

    const sortedPicks = [...picks].sort((a, b) => {
      const availA = a.current - a.reservedPick;
      const availB = b.current - b.reservedPick;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return availB - availA;
    });
    const pick = sortedPicks[0];

    const availStock = pick.current - pick.reservedPick;
    const qty = Math.max(1, Math.min(this.robotCapacity, availStock));

    const sortedDrops = [...drops].sort((a, b) => {
      const spaceA = a.maxCapacity - a.current - a.reservedDrop;
      const spaceB = b.maxCapacity - b.current - b.reservedDrop;
      return spaceB - spaceA;
    });
    const drop = sortedDrops[0];

    pick.reservePickup(qty);
    drop.reserveDrop(qty);

    const t = new Task([pick.x, pick.y], [drop.x, drop.y], pick.priority || priority, qty);
    t.createdTick = this.tick;
    t.pickStationId = pick.id;
    t.dropStationId = drop.id;
    return t;
  }

  private auction(task: Task): Robot | null {
    const eligible = this.robots.filter(
      r => r.state !== State.FAILED && r.task === null && !r.isCharging && !r.isEmergency && r.battery >= 15
    );
    if (eligible.length === 0) return null;

    let bestRobot = eligible[0];
    let bestBid = bestRobot.bid(task);

    for (let i = 1; i < eligible.length; i++) {
      const bid = eligible[i].bid(task);
      if (bid < bestBid) {
        bestBid = bid;
        bestRobot = eligible[i];
      }
    }
    return bestRobot;
  }

  addOrder(priority = 1, qty = 1): void {
    this.jobFinished = false;
    this.jobFinishedAnnounced = false;

    const task = this.newTask(priority, qty);
    if (!task) {
      this.events.push('No stock or drop capacity available for new order');
      return;
    }

    const winner = this.auction(task);
    if (winner) {
      winner.assign(task, this.grid, this.res, this.tick);
      task.assignedRobot = winner.id;
      this.events.push(`Order ${task.id} (${task.qty}pkg, p${task.priority}) → Robot ${winner.id}`);
    } else {
      this.pending.push(task);
      this.events.push(`Order ${task.id} queued (no idle robot)`);
    }
  }

  blockCell(x: number, y: number): void {
    this.grid.blockCell(x, y);
    this.events.push(`Cell (${x},${y}) blocked`);

    if (this.emergency.active) {
      const inCorridor = this.emergency.reservedCells.some(c => c[0] === x && c[1] === y);
      if (inCorridor && this.emergency.destination && this.emergency.robotId !== null) {
        const emergRobot = this.robots.find(r => r.id === this.emergency.robotId);
        if (emergRobot) {
          this.emergency.status = 'replanning';
          this.events.push(`🚨 Obstacle in corridor at (${x},${y})! Emergency Robot ${emergRobot.id} replanning.`);
          const newRoute = gridAStar(this.grid, [emergRobot.x, emergRobot.y], this.emergency.destination);
          if (newRoute && newRoute.length > 0) {
            emergRobot.path = newRoute;
            emergRobot.pathIdx = 0;
            this.emergency.route = newRoute;
            this.emergency.reservedCells = newRoute;
            this.emergency.intersections = this.findIntersections(newRoute);
            this.emergency.status = 'active';
            this.events.push(`🚨 Emergency Corridor rerouted (${newRoute.length} cells)`);
          } else {
            this.emergency.status = 'failed';
            this.emergency.message = `Corridor blocked at (${x},${y}) with no detour available`;
            emergRobot.state = State.WAITING;
            this.events.push(`❌ EMERGENCY CORRIDOR BLOCKED: No detour possible`);
          }
        }
      }
    }

    for (const r of this.robots) {
      if (
        !r.isEmergency &&
        r.state === State.MOVING &&
        r.path.slice(r.pathIdx).some(p => p[0] === x && p[1] === y)
      ) {
        r.replan(this.grid, this.res, this.tick);
        this.perf.recordReplan();
        this.events.push(`Robot ${r.id} replanning around obstacle`);
      }
    }
  }

  unblockCell(x: number, y: number): void {
    this.grid.unblockCell(x, y);
    this.events.push(`Cell (${x},${y}) unblocked`);
    for (const r of this.robots) {
      if (!r.isEmergency) {
        r.replan(this.grid, this.res, this.tick);
      }
    }
  }

  clearBlocks(): void {
    this.grid.clearUserBlocks();
    this.events.push('All custom obstacles cleared');
    for (const r of this.robots) {
      if (!r.isEmergency) {
        r.replan(this.grid, this.res, this.tick);
      }
    }
  }

  toggleCell(x: number, y: number): void {
    const wasBlocked = this.grid.cells[y][x] === 1;
    if (wasBlocked) {
      this.unblockCell(x, y);
    } else {
      this.blockCell(x, y);
    }
  }

  refillStation(sid: number, qty = 4, priority?: number): boolean {
    const s = this.stations.find(st => st.id === sid);
    if (s && s.type === 'pick') {
      s.restock(qty);
      if (priority) s.priority = Math.max(1, Math.min(3, priority));
      this.jobFinished = false;
      this.jobFinishedAnnounced = false;
      this.events.push(`Station ${sid} refilled +${qty} items (Priority P${s.priority})`);
      this.hiveMind.unshift({
        type: 'restock',
        msg: `Station ${sid} refilled +${qty} items (Priority P${s.priority})`,
      });

      for (const r of this.robots) {
        if (!r.isEmergency && r.state !== State.FAILED && (r.isCharging || r.chargeTarget || r.state === State.IDLE)) {
          r.isCharging = false;
          r.chargeTarget = null;
        }
      }

      return true;
    }
    return false;
  }

  failRobot(rid: number): void {
    const r = this.robots.find(robot => robot.id === rid);
    if (!r) return;

    if (r.isEmergency) {
      this.emergency.status = 'failed';
      this.emergency.message = `Emergency Robot ${rid} suffered critical failure`;
      this.events.push(`❌ CRITICAL: Emergency Robot ${rid} FAILED`);
      this.cancelEmergencyCorridor();
      return;
    }

    const lost = r.task;
    if (lost) {
      const pickS = this.stationAt(lost.pickup);
      if (pickS && lost.phase === 'pickup') pickS.releasePickupReservation(lost.qty);
      const dropS = this.stationAt(lost.dropoff);
      if (dropS) dropS.releaseDropReservation(lost.qty);
    }

    r.fail(this.res);
    this.grid.blockCell(r.x, r.y);
    this.events.push(`Robot ${rid} FAILED at (${r.x},${r.y})`);
    this.hiveMind.unshift({
      type: 'fail',
      msg: `R${rid} FAILED — re-auctioning task`,
    });

    if (lost) {
      const winner = this.auction(lost);
      if (winner) {
        const pickS = this.stationAt(lost.pickup);
        if (pickS && lost.phase === 'pickup') pickS.reservePickup(lost.qty);
        const dropS = this.stationAt(lost.dropoff);
        if (dropS) dropS.reserveDrop(lost.qty);

        winner.assign(lost, this.grid, this.res, this.tick);
        this.events.push(`Task ${lost.id} → Robot ${winner.id}`);
        this.hiveMind.unshift({
          type: 'auction',
          msg: `Task ${lost.id} re-auctioned to R${winner.id}`,
        });
      } else {
        this.pending.push(lost);
      }
    }
  }

  setStationPriority(sid: number, priority: number): boolean {
    const s = this.stations.find(st => st.id === sid);
    if (s) {
      s.priority = Math.max(1, Math.min(3, priority));
      this.events.push(`Station ${sid} priority set to P${priority}`);

      if (s.type === 'pick' && priority > 1) {
        const avail = s.current - s.reservedPick;
        const targetRobots = Math.min(priority, Math.ceil(avail / this.robotCapacity));
        for (let i = 0; i < targetRobots; i++) {
          this.addOrder(priority, this.robotCapacity);
        }
      }
      return true;
    }
    return false;
  }

  step(): void {
    this.events = [];
    const newHive: HiveMessage[] = [];
    this.tick++;
    this.res.releaseBefore(this.tick - 1);

    const totalPickStock = this.stations.filter(s => s.type === 'pick').reduce((sum, s) => sum + s.current, 0);
    const availablePickStock = this.stations.filter(s => s.type === 'pick').reduce((sum, s) => sum + Math.max(0, s.current - s.reservedPick), 0);

    // Ensure jobFinished is false if pick stock exists
    if (totalPickStock > 0) {
      this.jobFinished = false;
    }

    const chargingPads = this.grid.charging_stations && this.grid.charging_stations.length > 0
      ? this.grid.charging_stations
      : autoChargingStations(this.grid, this.robots.length);

    // Dynamic Emergency Corridor Progress & Check (2-Phase: Pickup -> Dropoff)
    let emergencyReservedSet = new Set<string>();
    if (this.emergency.active && this.emergency.robotId !== null) {
      const emergRobot = this.robots.find(r => r.id === this.emergency.robotId);
      if (emergRobot) {
        const { pickup, dropoff, phase } = this.emergency;

        // Check Phase 1: Reached Pickup
        if (phase === 'to_pickup' && pickup && emergRobot.x === pickup[0] && emergRobot.y === pickup[1]) {
          emergRobot.carrying = 1; // VIP cargo loaded
          this.emergency.phase = 'to_dropoff';
          const targetDrop = dropoff || pickup;
          this.emergency.destination = targetDrop;

          const path2 = gridAStar(this.grid, [emergRobot.x, emergRobot.y], targetDrop);
          if (path2 && path2.length > 0) {
            emergRobot.path = path2;
            emergRobot.pathIdx = 0;
            this.emergency.route = path2;
            this.emergency.reservedCells = path2;
            this.emergency.intersections = this.findIntersections(path2);
            this.events.push(`🚨 Emergency R${emergRobot.id} loaded VIP cargo at Pickup (${pickup[0]},${pickup[1]}). In transit to Dropoff (${targetDrop[0]},${targetDrop[1]}).`);
            newHive.push({
              type: 'emergency',
              msg: `🚨 Emergency R${emergRobot.id} loaded VIP cargo. En route to Dropoff (${targetDrop[0]},${targetDrop[1]}).`,
            });
          }
        }
        // Check Phase 2: Reached Dropoff
        else if (phase === 'to_dropoff' && dropoff && emergRobot.x === dropoff[0] && emergRobot.y === dropoff[1]) {
          this.emergency.status = 'completed';
          this.emergency.phase = 'delivered';
          this.emergency.active = false;
          this.emergency.reservedCells = [];
          this.emergency.yieldingRobots = [];
          this.emergency.reroutedRobots = [];
          emergRobot.isEmergency = false;
          emergRobot.carrying = 0;
          emergRobot.done++;
          this.events.push(`✅ EMERGENCY DELIVERY COMPLETED: Robot ${emergRobot.id} delivered VIP payload to Dropoff (${dropoff[0]},${dropoff[1]})!`);
          newHive.push({
            type: 'emergency',
            msg: `✅ Emergency VIP delivery completed by R${emergRobot.id}. Corridor released.`,
          });

          for (const r of this.robots) {
            r.isYielding = false;
            r.isRerouted = false;
          }
        }
        // Standard In-Transit Updates
        else {
          if (emergRobot.path && emergRobot.path.length > 0) {
            const currentIdx = Math.max(0, emergRobot.pathIdx);
            const remainingRoute = emergRobot.path.slice(currentIdx);
            this.emergency.reservedCells = remainingRoute;
          }
          emergencyReservedSet = new Set(this.emergency.reservedCells.map(c => `${c[0]},${c[1]}`));

          // Check if corridor route ahead is blocked
          const remainingPath = emergRobot.path.slice(emergRobot.pathIdx);
          const isBlocked = remainingPath.some(c => !this.grid.isFree(c[0], c[1]));
          const currentDest = this.emergency.destination;
          if (isBlocked && currentDest) {
            this.emergency.status = 'replanning';
            const newRoute = gridAStar(this.grid, [emergRobot.x, emergRobot.y], currentDest);
            if (newRoute && newRoute.length > 0) {
              emergRobot.path = newRoute;
              emergRobot.pathIdx = 0;
              this.emergency.route = newRoute;
              this.emergency.reservedCells = newRoute;
              this.emergency.intersections = this.findIntersections(newRoute);
              this.emergency.status = 'active';
              emergencyReservedSet = new Set(newRoute.map(c => `${c[0]},${c[1]}`));
              this.events.push(`🚨 Emergency route safely replanned around blockage`);
            } else {
              this.emergency.status = 'failed';
              this.emergency.message = 'Corridor blocked ahead with no alternate route';
              emergRobot.state = State.WAITING;
              this.events.push(`❌ EMERGENCY CORRIDOR BLOCKED: No route to destination`);
            }
          }

          // Update yielding and rerouted statuses
          const currentYielding: number[] = [];
          const currentRerouted: number[] = [];
          for (const r of this.robots) {
            if (r.id === emergRobot.id || r.state === State.FAILED) continue;
            if (emergencyReservedSet.has(`${r.x},${r.y}`)) {
              r.isYielding = true;
              currentYielding.push(r.id);
            } else {
              r.isYielding = false;
            }

            const pathCrosses = r.path.slice(r.pathIdx).some(c => emergencyReservedSet.has(`${c[0]},${c[1]}`));
            if (pathCrosses) {
              r.isRerouted = true;
              currentRerouted.push(r.id);
            } else {
              r.isRerouted = false;
            }
          }
          this.emergency.yieldingRobots = currentYielding;
          this.emergency.reroutedRobots = currentRerouted;
        }
      }
    }

    // Battery Check: Low Battery (< 15%) protection
    for (const r of this.robots) {
      if (!r.isEmergency && r.state !== State.FAILED && !r.isCharging && !r.chargeTarget && r.battery < 15) {
        if (r.task) {
          if (r.task.phase === 'pickup') {
            const pickS = this.stationAt(r.task.pickup);
            if (pickS) pickS.releasePickupReservation(r.task.qty);
            const dropS = this.stationAt(r.task.dropoff);
            if (dropS) dropS.releaseDropReservation(r.task.qty);
            r.task = null;
          }
        }
        const pad = chargingPads[r.id % chargingPads.length];
        r.navigateToCharge(pad, this.grid, this.res, this.tick, this.robots);
        this.events.push(`⚡ Robot ${r.id} Battery Low (${r.battery}%) → Charging Pad (${pad[0]},${pad[1]})`);
        newHive.push({
          type: 'restock',
          msg: `⚡ R${r.id} Battery Low (${r.battery}%) — routing to charge`,
        });
      }
    }

    // Priority Dispatch
    const highPriorityPick = this.stations.find(s => s.type === 'pick' && s.priority >= 2 && (s.current - s.reservedPick) > 0);
    if (highPriorityPick && this.tick % 4 === 0) {
      this.addOrder(highPriorityPick.priority, this.robotCapacity);
    }

    // Assign pending tasks to newly-idle robots
    for (const r of this.robots) {
      if (!r.isEmergency && r.task === null && r.state === State.IDLE && !r.isCharging && !r.chargeTarget && r.battery >= 15 && this.pending.length > 0) {
        const task = this.pending.shift()!;
        r.assign(task, this.grid, this.res, this.tick, this.robots);
        task.assignedRobot = r.id;
        this.events.push(`Pending task ${task.id} → Robot ${r.id}`);
      }
    }

    // Replan waiting normal robots
    for (const r of this.robots) {
      if (!r.isEmergency && r.state === State.WAITING && (r.task || r.chargeTarget)) {
        r.replan(this.grid, this.res, this.tick, this.robots);
      }
    }

    // Auto-generate orders if pick stock remains
    if (this.tick % 4 === 0 && availablePickStock > 0) {
      this.addOrder(1, this.robotCapacity);
    }

    // JOB FINISHED: Only trigger when total pick stock is genuinely 0 and all deliveries are done
    const activeTasks = this.robots.some(r => r.task !== null || r.carrying > 0 || r.isEmergency);
    if (totalPickStock === 0 && this.pending.length === 0 && !activeTasks && this.tick > 5) {
      this.jobFinished = true;
      if (!this.jobFinishedAnnounced) {
        this.jobFinishedAnnounced = true;
        this.events.push('🎉 JOB FINISHED: All picking items delivered! Robots navigating to Charging Stations.');
        newHive.push({
          type: 'job_finished',
          msg: '🎉 JOB FINISHED: All items picked and delivered. Robots heading to chargers.',
        });
      }
    }

    // Direct idle non-emergency robots to charging pads
    this.robots.forEach((r, idx) => {
      if (r.isEmergency) return;
      const pad = chargingPads[idx % chargingPads.length];
      const atPad = r.x === pad[0] && r.y === pad[1];
      if (atPad && !r.task && (this.jobFinished || totalPickStock === 0)) {
        r.isCharging = true;
        r.chargeTarget = [...pad];
        r.path = [];
        r.pathIdx = 0;
      } else if (
        r.state !== State.FAILED &&
        !r.isCharging &&
        !r.chargeTarget &&
        r.task === null &&
        r.carrying === 0 &&
        (this.jobFinished || totalPickStock === 0)
      ) {
        r.navigateToCharge(pad, this.grid, this.res, this.tick, this.robots);
        this.events.push(`Robot ${r.id} navigating to Charging Station (${pad[0]},${pad[1]})`);
      }
    });

    // Snapshots before step
    const preTasks = new Map<number, Task | null>();
    const preCarrying = new Map<number, number>();
    for (const r of this.robots) {
      preTasks.set(r.id, r.task);
      preCarrying.set(r.id, r.carrying);
    }

    // PIBT Step with Dynamic Emergency Corridor Awareness
    const { moves, messages: pibtMsgs } = pibtStep(
      this.robots,
      this.grid,
      this.emergency.active ? emergencyReservedSet : undefined,
      this.emergency.active ? this.emergency.robotId : null
    );

    for (const m of pibtMsgs) {
      if (m.type === 'yield' || m.type === 'emergency') {
        this.perf.recordConflict();
      }
    }
    newHive.push(...pibtMsgs);

    // Apply moves
    for (const r of this.robots) {
      if (!moves.has(r.id)) continue;
      const [nx, ny] = moves.get(r.id)!;
      const event = r.applyMove(nx, ny, this.grid, this.res, this.tick);
      this.perf.visit(nx, ny);

      if (event === 'pickup_reached') {
        const task = r.task;
        if (task) {
          const station = this.stationAt(task.pickup);
          const actual = station ? station.doPickup(task.qty) : task.qty;
          r.carrying = actual;
          newHive.push({
            type: 'pickup',
            msg: `R${r.id} picks up ${actual}pkg at (${task.pickup[0]},${task.pickup[1]})`,
          });
          this.events.push(`Robot ${r.id} picked up ${actual} packages`);
        }
      } else if (event === 'dropoff_reached') {
        const prev = preTasks.get(r.id);
        const carry = preCarrying.get(r.id) || 1;
        if (prev) {
          const duration = this.tick - prev.createdTick;
          this.perf.recordDelivery(duration);
          const station = this.stationAt(prev.dropoff);
          if (station) {
            station.doDrop(carry);
          }
          newHive.push({
            type: 'delivery',
            msg: `R${r.id} delivers ${carry}pkg to (${prev.dropoff[0]},${prev.dropoff[1]}) [${duration}t]`,
          });
          this.events.push(`Robot ${r.id} completed Task ${prev.id} (${duration} ticks)`);

          const remPickStock = this.stations.filter(s => s.type === 'pick').reduce((sum, s) => sum + s.current, 0);
          if (remPickStock === 0 || this.jobFinished) {
            const pad = chargingPads[r.id % chargingPads.length];
            if (r.x === pad[0] && r.y === pad[1]) {
              r.isCharging = true;
              r.chargeTarget = [...pad];
            } else {
              r.navigateToCharge(pad, this.grid, this.res, this.tick, this.robots);
              this.events.push(`Robot ${r.id} heading to Charging Station (${pad[0]},${pad[1]}) after dropoff`);
            }
          }
        }
      }
    }

    // Post-move space-time replanning
    for (const r of this.robots) {
      if (!r.isEmergency && r.state !== State.FAILED && !r.isCharging && (r.task || r.chargeTarget)) {
        if (r.state === State.WAITING || r.path.length === 0 || r.pathIdx >= r.path.length - 1) {
          r.replan(this.grid, this.res, this.tick, this.robots);
        }
      }
    }

    this.hiveMind = [...newHive, ...this.hiveMind].slice(0, 30);
  }

  stateDict(): SimulatorState {
    const heatmap = this.tick % 3 === 0 ? this.perf.heatmapTop(80) : [];
    const activeRobots = this.robots.filter(r => (r.state === State.MOVING || r.isEmergency) && !r.isCharging).length;
    const idleRobots = this.robots.filter(r => r.state === State.IDLE && !r.isCharging && !r.isEmergency).length;
    const failedRobots = this.robots.filter(r => r.state === State.FAILED).length;
    const chargingRobots = this.robots.filter(r => r.isCharging).length;
    const totalThroughput = this.robots.reduce((acc, r) => acc + r.done, 0);
    const totalPickStock = this.stations.filter(s => s.type === 'pick').reduce((sum, s) => sum + s.current, 0);

    return {
      tick: this.tick,
      running: this.running,
      job_finished: this.jobFinished,
      total_pick_stock: totalPickStock,
      robots: this.robots.map(r => r.toDict()),
      stations: this.stations.map(s => s.toDict()),
      hive_mind: this.hiveMind.slice(0, 20),
      conflicts: predictConflicts(this.robots),
      performance: this.perf.toDict(this.tick),
      heatmap,
      events: this.events,
      metrics: {
        throughput: totalThroughput,
        active: activeRobots,
        idle: idleRobots,
        failed: failedRobots,
        charging: chargingRobots,
      },
      emergency: { ...this.emergency },
    };
  }

  start(broadcast: (state: SimulatorState) => void): void {
    if (this.running) return;
    this.running = true;
    this.broadcastFn = broadcast;

    if (this.tick === 0) {
      for (let i = 0; i < this.robots.length; i++) {
        this.addOrder();
      }
    }

    this.intervalId = setInterval(() => {
      if (!this.running) return;
      this.step();
      const state = this.stateDict();
      if (this.tick <= 2 || this.tick % 30 === 0) {
        state.grid = this.grid.toDict();
      }
      if (this.broadcastFn) {
        this.broadcastFn(state);
      }
    }, this.tickDelay);
  }

  pause(): void {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reset(): void {
    this.pause();
    this.tick = 0;
    this.events = [];
    this.hiveMind = [];
    this.pending = [];
    this.res.clear();
    this.perf.reset();
    this.jobFinished = false;
    this.jobFinishedAnnounced = false;
    this.cancelEmergencyCorridor();
    Station.resetCounter();
    Task.resetCounter();
    this.initStations();
    this.spawnRobots(this.robots.length || 5);
  }
}
