import { Grid } from './Grid';
import { ReservationTable } from './Reservation';
import { spaceTimeAStar, gridAStar } from './AStar';

export enum State {
  IDLE = 'idle',
  MOVING = 'moving',
  WAITING = 'waiting',
  FAILED = 'failed',
}

export const ROBOT_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#E91E63',
  '#9C27B0', '#00BCD4', '#FF5722', '#607D8B',
  '#F44336', '#00E676', '#FFEA00', '#40C4FF',
];

export class Task {
  private static counter = 0;

  static resetCounter(): void {
    Task.counter = 0;
  }

  id: number;
  pickup: [number, number];
  dropoff: [number, number];
  priority: number;
  qty: number;
  phase: 'pickup' | 'dropoff';
  assignedRobot: number | null;
  createdTick: number;
  pickStationId?: number;
  dropStationId?: number;

  constructor(pickup: [number, number], dropoff: [number, number], priority = 1, qty = 1) {
    Task.counter++;
    this.id = Task.counter;
    this.pickup = [...pickup];
    this.dropoff = [...dropoff];
    this.priority = priority;
    this.qty = qty;
    this.phase = 'pickup';
    this.assignedRobot = null;
    this.createdTick = 0;
  }

  get goal(): [number, number] {
    return this.phase === 'pickup' ? this.pickup : this.dropoff;
  }
}

export interface RobotDict {
  id: number;
  x: number;
  y: number;
  color: string;
  state: string;
  phase: string | null;
  task_id: number | null;
  target: [number, number] | null;
  pickup: [number, number] | null;
  dropoff: [number, number] | null;
  carrying: number;
  capacity: number;
  battery: number;
  path: [number, number][];
  done: number;
  isEmergency?: boolean;
  isYielding?: boolean;
  isRerouted?: boolean;
}

export class Robot {
  id: number;
  x: number;
  y: number;
  color: string;
  state: State;
  task: Task | null;
  path: [number, number][];
  pathIdx: number;
  done: number;
  capacity: number;
  carrying: number;
  battery: number;
  chargeTarget: [number, number] | null;
  isCharging: boolean;
  isEmergency: boolean;
  isYielding: boolean;
  isRerouted: boolean;

  constructor(id: number, start: [number, number], capacity = 1) {
    this.id = id;
    this.x = start[0];
    this.y = start[1];
    this.color = ROBOT_COLORS[id % ROBOT_COLORS.length];
    this.state = State.IDLE;
    this.task = null;
    this.path = [];
    this.pathIdx = 0;
    this.done = 0;
    this.capacity = capacity;
    this.carrying = 0;
    this.battery = 100;
    this.chargeTarget = null;
    this.isCharging = false;
    this.isEmergency = false;
    this.isYielding = false;
    this.isRerouted = false;
  }

  get pos(): [number, number] {
    return [this.x, this.y];
  }

  assign(task: Task, grid: Grid, res: ReservationTable, tick: number, robots?: Robot[]): void {
    this.task = task;
    this.chargeTarget = null;
    this.isCharging = false;
    this.state = State.MOVING;
    this.plan(grid, res, tick, robots);
  }

  navigateToCharge(target: [number, number], grid: Grid, res: ReservationTable, tick: number, robots?: Robot[]): void {
    this.chargeTarget = [...target];
    this.task = null;
    this.isCharging = false;

    let path = spaceTimeAStar(grid, this.pos, target, res, this.id, tick, 250, robots);
    if ((!path || path.length === 0) && robots) {
      path = spaceTimeAStar(grid, this.pos, target, res, this.id, tick, 250);
    }
    if (!path || path.length === 0) {
      path = gridAStar(grid, this.pos, target);
    }

    if (path && path.length > 0) {
      this.path = path;
      this.pathIdx = 0;
      res.release(this.id);
      for (let i = 0; i < path.length; i++) {
        const [px, py] = path[i];
        res.claim(px, py, tick + i, this.id);
      }
      this.state = State.MOVING;
    } else {
      this.state = State.WAITING;
      res.release(this.id);
      res.claim(this.x, this.y, tick, this.id);
    }
  }

  plan(grid: Grid, res: ReservationTable, tick: number, robots?: Robot[]): void {
    if (!this.task) return;

    let path = spaceTimeAStar(
      grid,
      this.pos,
      this.task.goal,
      res,
      this.id,
      tick,
      250,
      robots
    );

    if ((!path || path.length === 0) && robots) {
      path = spaceTimeAStar(
        grid,
        this.pos,
        this.task.goal,
        res,
        this.id,
        tick,
        250
      );
    }

    if (!path || path.length === 0) {
      path = gridAStar(grid, this.pos, this.task.goal);
    }

    if (path && path.length > 0) {
      this.path = path;
      this.pathIdx = 0;
      res.release(this.id);
      for (let i = 0; i < path.length; i++) {
        const [px, py] = path[i];
        res.claim(px, py, tick + i, this.id);
      }
      this.state = State.MOVING;
    } else {
      this.state = State.WAITING;
      res.release(this.id);
      res.claim(this.x, this.y, tick, this.id);
      res.claim(this.x, this.y, tick + 1, this.id);
    }
  }

  replan(grid: Grid, res: ReservationTable, tick: number, robots?: Robot[]): void {
    if (this.task && this.state !== State.FAILED) {
      this.plan(grid, res, tick, robots);
    } else if (this.chargeTarget && !this.isCharging && this.state !== State.FAILED) {
      this.navigateToCharge(this.chargeTarget, grid, res, tick, robots);
    }
  }

  applyMove(
    nx: number,
    ny: number,
    grid: Grid,
    res: ReservationTable,
    tick: number
  ): 'pickup_reached' | 'dropoff_reached' | null {
    if (this.state === State.FAILED) {
      return null;
    }

    // Battery depletion & charging logic
    if (this.isCharging) {
      this.battery = Math.min(100, Math.round((this.battery + 8) * 10) / 10);
      if (this.battery >= 100) {
        this.battery = 100;
        this.isCharging = false;
        this.chargeTarget = null;
        if (!this.task) {
          this.state = State.IDLE;
        } else {
          this.state = State.MOVING;
        }
      }
      res.release(this.id);
      res.claim(this.x, this.y, tick, this.id);
      return null;
    } else {
      this.battery = Math.max(0, Math.round((this.battery - 0.4) * 10) / 10);
    }

    const moved = nx !== this.x || ny !== this.y;
    this.x = nx;
    this.y = ny;

    if (moved) {
      this.state = State.MOVING;
      if (
        this.path.length > 0 &&
        this.pathIdx + 1 < this.path.length &&
        this.path[this.pathIdx + 1][0] === nx &&
        this.path[this.pathIdx + 1][1] === ny
      ) {
        this.pathIdx++;
      } else {
        this.path = [];
        this.pathIdx = 0;
      }
    } else if (this.path.length > 0) {
      this.state = State.WAITING;
    }

    // Charging target check
    if (this.chargeTarget && this.x === this.chargeTarget[0] && this.y === this.chargeTarget[1]) {
      this.isCharging = true;
      this.path = [];
      this.pathIdx = 0;
      res.release(this.id);
      res.claim(this.x, this.y, tick, this.id);
      return null;
    }

    if (!this.task) return null;

    if (this.x === this.task.goal[0] && this.y === this.task.goal[1]) {
      if (this.task.phase === 'pickup') {
        this.task.phase = 'dropoff';
        this.plan(grid, res, tick + 1);
        this.state = State.MOVING;
        return 'pickup_reached';
      } else {
        this.done++;
        this.task = null;
        this.state = State.IDLE;
        this.path = [];
        this.carrying = 0;
        res.release(this.id);
        return 'dropoff_reached';
      }
    }

    if (this.task && this.path.length === 0) {
      this.plan(grid, res, tick + 1);
    }

    return null;
  }

  fail(res: ReservationTable): void {
    this.state = State.FAILED;
    this.carrying = 0;
    this.isCharging = false;
    res.release(this.id);
  }

  bid(task: Task): number {
    const d = Math.abs(this.x - task.pickup[0]) + Math.abs(this.y - task.pickup[1]);
    return (d + Math.random() * 0.5) / task.priority;
  }

  toDict(): RobotDict {
    const activePath = this.path.slice(this.pathIdx);
    let stateStr: string = this.state;
    if (this.isCharging) stateStr = 'charging';
    else if (this.chargeTarget && this.state === State.MOVING) stateStr = 'moving';

    let phaseStr: string | null = this.task ? this.task.phase : null;
    if (this.isCharging || this.chargeTarget) phaseStr = 'charging';

    return {
      id: this.id,
      x: this.x,
      y: this.y,
      color: this.color,
      state: stateStr,
      phase: phaseStr,
      task_id: this.task ? this.task.id : null,
      target: this.task ? [...this.task.goal] : this.chargeTarget ? [...this.chargeTarget] : null,
      pickup: this.task ? [...this.task.pickup] : null,
      dropoff: this.task ? [...this.task.dropoff] : null,
      carrying: this.carrying,
      capacity: this.capacity,
      battery: Math.round(this.battery),
      path: activePath,
      done: this.done,
      isEmergency: this.isEmergency,
      isYielding: this.isYielding,
      isRerouted: this.isRerouted,
    };
  }
}
