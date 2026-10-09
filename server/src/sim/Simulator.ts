import { Grid, createWarehouse, GridDict, autoChargingStations } from './Grid';
import { ReservationTable } from './Reservation';
import { Robot, Task, State, RobotDict } from './Robot';
import { Station, StationDict } from './Station';
import { pibtStep, HiveMessage } from './PIBT';
import { predictConflicts, ConflictPrediction } from './Predictor';
import { PerformanceTracker, PerformanceDict, HeatmapPoint } from './PerformanceTracker';

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
    // Generate charging pads equal to the number of robots
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

  private newTask(priority = 1, requestedQty = 1): Task | null {
    const picks = this.stations.filter(s => s.type === 'pick' && s.canPickup(1));
    const drops = this.stations.filter(s => s.type === 'drop' && s.canDrop(1));
    if (picks.length === 0 || drops.length === 0) return null;

    // Sort pick stations by priority and available unreserved stock (highest first)
    const sortedPicks = [...picks].sort((a, b) => {
      const availA = a.current - a.reservedPick;
      const availB = b.current - b.reservedPick;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return availB - availA;
    });
    const pick = sortedPicks[0];

    // Always attempt maximum load capacity assigned to AGV (e.g., 4, or 3, 2, 1 if less available)
    const availStock = pick.current - pick.reservedPick;
    const qty = Math.max(1, Math.min(this.robotCapacity, availStock));

    // Sort drop stations by available capacity (highest space left first)
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
    const eligible = this.robots.filter(r => r.state !== State.FAILED && r.task === null && !r.isCharging && r.battery >= 15);
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

    for (const r of this.robots) {
      if (
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
      r.replan(this.grid, this.res, this.tick);
    }
  }

  clearBlocks(): void {
    this.grid.clearUserBlocks();
    this.events.push('All custom obstacles cleared');
    for (const r of this.robots) {
      r.replan(this.grid, this.res, this.tick);
    }
  }

  toggleCell(x: number, y: number): void {
    this.grid.toggleCell(x, y);
    this.events.push(`Cell (${x},${y}) toggled`);
    for (const r of this.robots) {
      if (
        r.state === State.MOVING &&
        r.path.slice(r.pathIdx).some(p => p[0] === x && p[1] === y)
      ) {
        r.replan(this.grid, this.res, this.tick);
        this.perf.recordReplan();
      }
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

      // Resume idle/charging robots if refilled
      for (const r of this.robots) {
        if (r.state !== State.FAILED && (r.isCharging || r.chargeTarget || r.state === State.IDLE)) {
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

    const lost = r.task;
    if (lost) {
      // Release reservations if lost task cannot be completed
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
        // Re-reserve
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

      // High priority (P3/P2): Dispatch multiple robots based on workload
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

    const chargingPads = this.grid.charging_stations && this.grid.charging_stations.length > 0
      ? this.grid.charging_stations
      : autoChargingStations(this.grid, this.robots.length);

    // Battery Check: Low Battery (< 15%) protection
    for (const r of this.robots) {
      if (r.state !== State.FAILED && !r.isCharging && !r.chargeTarget && r.battery < 15) {
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

    // Priority Dispatch: High priority pick stations get multiple orders allocated
    const highPriorityPick = this.stations.find(s => s.type === 'pick' && s.priority >= 2 && (s.current - s.reservedPick) > 0);
    if (highPriorityPick && this.tick % 4 === 0) {
      this.addOrder(highPriorityPick.priority, this.robotCapacity);
    }

    // Assign pending tasks to newly-idle robots if stock available & battery >= 15%
    for (const r of this.robots) {
      if (r.task === null && r.state === State.IDLE && !r.isCharging && !r.chargeTarget && r.battery >= 15 && this.pending.length > 0) {
        const task = this.pending.shift()!;
        r.assign(task, this.grid, this.res, this.tick, this.robots);
        task.assignedRobot = r.id;
        this.events.push(`Pending task ${task.id} → Robot ${r.id}`);
      }
    }

    // Replan waiting robots or robots needing path refresh
    for (const r of this.robots) {
      if (r.state === State.WAITING && (r.task || r.chargeTarget)) {
        r.replan(this.grid, this.res, this.tick, this.robots);
      }
    }

    // Auto-generate orders if pick stock remains
    if (this.tick % 4 === 0 && availablePickStock > 0) {
      this.addOrder(1, this.robotCapacity);
    }

    // JOB FINISHED / Charging Dispatch Check
    const activeTasks = this.robots.some(r => r.task !== null || r.carrying > 0);
    if ((totalPickStock === 0 || availablePickStock === 0) && this.pending.length === 0 && !activeTasks) {
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

    // Direct any idle robot (without tasks/carrying) to its charging pad if job is finished or no pick stock left
    this.robots.forEach((r, idx) => {
      const pad = chargingPads[idx % chargingPads.length];
      const atPad = r.x === pad[0] && r.y === pad[1];
      if (atPad && !r.task && (this.jobFinished || availablePickStock === 0)) {
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
        (this.jobFinished || availablePickStock === 0)
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

    // PIBT step
    const { moves, messages: pibtMsgs } = pibtStep(this.robots, this.grid);
    for (const m of pibtMsgs) {
      if (m.type === 'yield') {
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

          // Immediately route to charge if no more picking items remain
          const remPickStock = this.stations.filter(s => s.type === 'pick').reduce((sum, s) => sum + Math.max(0, s.current - s.reservedPick), 0);
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

    // Post-move space-time replanning for robots that detoured/reversed/waited or need path update
    for (const r of this.robots) {
      if (r.state !== State.FAILED && !r.isCharging && (r.task || r.chargeTarget)) {
        if (r.state === State.WAITING || r.path.length === 0 || r.pathIdx >= r.path.length - 1) {
          r.replan(this.grid, this.res, this.tick, this.robots);
        }
      }
    }

    this.hiveMind = [...newHive, ...this.hiveMind].slice(0, 30);
  }

  stateDict(): SimulatorState {
    const heatmap = this.tick % 3 === 0 ? this.perf.heatmapTop(80) : [];
    const activeRobots = this.robots.filter(r => r.state === State.MOVING && !r.isCharging).length;
    const idleRobots = this.robots.filter(r => r.state === State.IDLE && !r.isCharging).length;
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
    };
  }

  start(broadcast: (state: SimulatorState) => void): void {
    if (this.running) return;
    this.running = true;
    this.broadcastFn = broadcast;

    // Initial order seeding
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
    Station.resetCounter();
    Task.resetCounter();
    this.initStations();
    this.spawnRobots(this.robots.length || 5);
  }
}
