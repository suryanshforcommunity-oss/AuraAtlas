import { Grid } from './Grid';
import { ReservationTable } from './Reservation';

function heuristic(a: [number, number], b: [number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

interface Node {
  f: number;
  g: number;
  t: number;
  x: number;
  y: number;
}

class MinHeap {
  private heap: Node[] = [];

  push(node: Node): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): Node | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.heap[idx].f < this.heap[parentIdx].f) {
        [this.heap[idx], this.heap[parentIdx]] = [this.heap[parentIdx], this.heap[idx]];
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  private sinkDown(idx: number): void {
    const length = this.heap.length;
    while (true) {
      let left = 2 * idx + 1;
      let right = 2 * idx + 2;
      let smallest = idx;

      if (left < length && this.heap[left].f < this.heap[smallest].f) {
        smallest = left;
      }
      if (right < length && this.heap[right].f < this.heap[smallest].f) {
        smallest = right;
      }
      if (smallest !== idx) {
        [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
        idx = smallest;
      } else {
        break;
      }
    }
  }
}

export function spaceTimeAStar(
  grid: Grid,
  start: [number, number],
  goal: [number, number],
  reservation: ReservationTable,
  robotId: number,
  startTime = 0,
  maxTime = 250,
  robots?: any[],
  avoidCells?: Set<string>
): [number, number][] | null {
  if (start[0] === goal[0] && start[1] === goal[1]) {
    return [[...start]];
  }

  const isOccupied = (nx: number, ny: number, nt: number): boolean => {
    if (avoidCells && avoidCells.has(`${nx},${ny}`)) {
      if (nx !== start[0] || ny !== start[1]) {
        return true;
      }
    }

    if (reservation.isReserved(nx, ny, nt, robotId)) {
      return true;
    }
    const isGoal = nx === goal[0] && ny === goal[1];
    if (robots && !isGoal) {
      for (const r of robots) {
        if (r.id === robotId || r.state === 'failed') continue;
        let rx = r.x;
        let ry = r.y;
        if (r.path && r.path.length > 0) {
          const dt = nt - startTime;
          const targetIdx = r.pathIdx + dt;
          if (targetIdx >= 0) {
            if (targetIdx < r.path.length) {
              rx = r.path[targetIdx][0];
              ry = r.path[targetIdx][1];
            } else {
              rx = r.path[r.path.length - 1][0];
              ry = r.path[r.path.length - 1][1];
            }
          }
        }
        if (rx === nx && ry === ny) {
          return true;
        }
      }
    }
    return false;
  };

  const isSwap = (x: number, y: number, nx: number, ny: number, t: number): boolean => {
    if (reservation.isSwapConflict(x, y, nx, ny, t, robotId)) {
      return true;
    }
    if (robots) {
      for (const r of robots) {
        if (r.id === robotId || r.state === 'failed') continue;
        let rxT = r.x;
        let ryT = r.y;
        let rxT1 = r.x;
        let ryT1 = r.y;

        if (r.path && r.path.length > 0) {
          const dtT = t - startTime;
          const idxT = r.pathIdx + dtT;
          if (idxT >= 0) {
            if (idxT < r.path.length) {
              rxT = r.path[idxT][0];
              ryT = r.path[idxT][1];
            } else {
              rxT = r.path[r.path.length - 1][0];
              ryT = r.path[r.path.length - 1][1];
            }
          }

          const dtT1 = t + 1 - startTime;
          const idxT1 = r.pathIdx + dtT1;
          if (idxT1 >= 0) {
            if (idxT1 < r.path.length) {
              rxT1 = r.path[idxT1][0];
              ryT1 = r.path[idxT1][1];
            } else {
              rxT1 = r.path[r.path.length - 1][0];
              ryT1 = r.path[r.path.length - 1][1];
            }
          }
        }

        if (rxT === nx && ryT === ny && rxT1 === x && ryT1 === y) {
          return true;
        }
      }
    }
    return false;
  };

  const heap = new MinHeap();
  heap.push({
    f: heuristic(start, goal),
    g: 0,
    t: startTime,
    x: start[0],
    y: start[1],
  });

  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();

  const startKey = `${start[0]},${start[1]},${startTime}`;
  gScore.set(startKey, 0);

  const maxHorizon = startTime + maxTime;

  while (heap.size > 0) {
    const curr = heap.pop()!;
    const { g, t, x, y } = curr;

    if (x === goal[0] && y === goal[1]) {
      const path: [number, number][] = [];
      let stateKey = `${x},${y},${t}`;
      while (cameFrom.has(stateKey)) {
        const [px, py] = stateKey.split(',').map(Number);
        path.push([px, py]);
        stateKey = cameFrom.get(stateKey)!;
      }
      path.push([...start]);
      return path.reverse();
    }

    if (t >= maxHorizon) {
      continue;
    }

    const currStateKey = `${x},${y},${t}`;
    if (g > (gScore.get(currStateKey) ?? Infinity)) {
      continue;
    }

    const neighbors = [...grid.getNeighbors(x, y), [x, y] as [number, number]];
    for (const [nx, ny] of neighbors) {
      const nt = t + 1;
      if (isOccupied(nx, ny, nt)) {
        continue;
      }
      if (isSwap(x, y, nx, ny, t)) {
        continue;
      }

      const ng = g + 1;
      const nextStateKey = `${nx},${ny},${nt}`;

      if (ng < (gScore.get(nextStateKey) ?? Infinity)) {
        gScore.set(nextStateKey, ng);
        heap.push({
          f: ng + heuristic([nx, ny], goal),
          g: ng,
          t: nt,
          x: nx,
          y: ny,
        });
        cameFrom.set(nextStateKey, currStateKey);
      }
    }
  }

  return null;
}

export function gridAStar(
  grid: Grid,
  start: [number, number],
  goal: [number, number],
  avoidCells?: Set<string>
): [number, number][] | null {
  if (start[0] === goal[0] && start[1] === goal[1]) {
    return [[...start]];
  }

  const heap = new MinHeap();
  heap.push({
    f: heuristic(start, goal),
    g: 0,
    t: 0,
    x: start[0],
    y: start[1],
  });

  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const startKey = `${start[0]},${start[1]}`;
  gScore.set(startKey, 0);

  while (heap.size > 0) {
    const curr = heap.pop()!;
    const { g, x, y } = curr;

    if (x === goal[0] && y === goal[1]) {
      const path: [number, number][] = [];
      let key = `${x},${y}`;
      while (cameFrom.has(key)) {
        const [px, py] = key.split(',').map(Number);
        path.push([px, py]);
        key = cameFrom.get(key)!;
      }
      path.push([...start]);
      return path.reverse();
    }

    const currKey = `${x},${y}`;
    if (g > (gScore.get(currKey) ?? Infinity)) {
      continue;
    }

    const nbrs = grid.getNeighbors(x, y);
    for (const [nx, ny] of nbrs) {
      if (avoidCells && avoidCells.has(`${nx},${ny}`)) {
        if (nx !== goal[0] || ny !== goal[1]) {
          continue;
        }
      }

      const ng = g + 1;
      const nextKey = `${nx},${ny}`;

      if (ng < (gScore.get(nextKey) ?? Infinity)) {
        gScore.set(nextKey, ng);
        heap.push({
          f: ng + heuristic([nx, ny], goal),
          g: ng,
          t: 0,
          x: nx,
          y: ny,
        });
        cameFrom.set(nextKey, currKey);
      }
    }
  }

  return null;
}
