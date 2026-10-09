import { Grid } from './Grid';
import { Robot, State } from './Robot';

export interface HiveMessage {
  type: string;
  msg: string;
}

export function pibtStep(
  robots: Robot[],
  grid: Grid,
  emergencyReservedCells?: Set<string>,
  emergencyRobotId?: number | null
): { moves: Map<number, [number, number]>; messages: HiveMessage[] } {
  const activeMap = new Map<number, Robot>();
  for (const r of robots) {
    if (r.state === State.MOVING || r.state === State.WAITING) {
      activeMap.set(r.id, r);
    }
  }

  if (activeMap.size === 0) {
    return { moves: new Map(), messages: [] };
  }

  const messages: HiveMessage[] = [];

  const basePriority = (r: Robot): number => {
    if (r.isEmergency || (emergencyRobotId !== undefined && emergencyRobotId !== null && r.id === emergencyRobotId)) {
      const gx = r.path && r.path.length > 0 ? r.path[r.path.length - 1][0] : r.x;
      const gy = r.path && r.path.length > 0 ? r.path[r.path.length - 1][1] : r.y;
      return 10000000 - (Math.abs(r.x - gx) + Math.abs(r.y - gy));
    }
    if (!r.task && !r.chargeTarget) return 0;
    const goal = r.task ? r.task.goal : r.chargeTarget!;
    const [gx, gy] = goal;
    const pri = r.task ? r.task.priority : 1;
    let val = pri * 10000 - (Math.abs(r.x - gx) + Math.abs(r.y - gy));
    if (r.isYielding) val -= 50000;
    return val;
  };

  const priorities = new Map<number, number>();
  const curPos = new Map<string, number>();

  for (const [rid, r] of activeMap.entries()) {
    priorities.set(rid, basePriority(r));
  }
  for (const r of robots) {
    curPos.set(`${r.x},${r.y}`, r.id);
  }

  const result = new Map<number, [number, number]>();
  const claimed = new Map<string, number>();
  const inCall = new Set<number>();

  const isReserved = (x: number, y: number): boolean => {
    return emergencyReservedCells !== undefined && emergencyReservedCells.has(`${x},${y}`);
  };

  const candidates = (robot: Robot): [number, number][] => {
    const seen = new Set<string>();
    const out: [number, number][] = [];
    const isEmerg = robot.isEmergency || (emergencyRobotId !== undefined && emergencyRobotId !== null && robot.id === emergencyRobotId);
    const currentlyOnCorridor = isReserved(robot.x, robot.y);

    const add = (x: number, y: number) => {
      const key = `${x},${y}`;
      if (!seen.has(key) && grid.isFree(x, y)) {
        // Normal robots cannot enter reserved corridor cells from outside
        if (!isEmerg && isReserved(x, y)) {
          // Only allow if robot is already on this exact cell and has no other choice
          if (x !== robot.x || y !== robot.y) {
            return;
          }
        }
        seen.add(key);
        out.push([x, y]);
      }
    };

    // If a normal robot is currently trapped on the corridor, prioritize non-reserved neighbors to yield OUT immediately
    if (!isEmerg && currentlyOnCorridor) {
      const allNbrs = grid.getNeighbors(robot.x, robot.y);
      const nonCorridorNbrs = allNbrs.filter(([nx, ny]) => !isReserved(nx, ny));
      for (const [nx, ny] of nonCorridorNbrs) {
        add(nx, ny);
      }
    }

    // 1. Next planned waypoint
    if (robot.path && robot.pathIdx + 1 < robot.path.length) {
      const [px, py] = robot.path[robot.pathIdx + 1];
      add(px, py);
    }

    // 2. Reverse / Backtrack step for collision avoidance
    if (robot.path && robot.pathIdx > 0 && robot.pathIdx - 1 < robot.path.length) {
      const [rx, ry] = robot.path[robot.pathIdx - 1];
      add(rx, ry);
    }

    // 3. Goal-oriented neighbors
    if (robot.task || robot.chargeTarget) {
      const goal = robot.task ? robot.task.goal : robot.chargeTarget!;
      const [gx, gy] = goal;
      const nbrs = grid.getNeighbors(robot.x, robot.y);
      nbrs.sort((a, b) => {
        const da = Math.abs(a[0] - gx) + Math.abs(a[1] - gy);
        const db = Math.abs(b[0] - gx) + Math.abs(b[1] - gy);
        return da - db;
      });
      for (const [nx, ny] of nbrs) {
        add(nx, ny);
      }
    }

    // 4. All free neighbors (allow yielding into side aisles/corridors)
    const allNbrs = grid.getNeighbors(robot.x, robot.y);
    for (const [nx, ny] of allNbrs) {
      add(nx, ny);
    }

    // 5. Stay in place fallback
    add(robot.x, robot.y);
    return out;
  };

  const tryMove = (rid: number, depth = 0): boolean => {
    if (result.has(rid)) return true;

    if (depth > activeMap.size + 2) {
      const r = activeMap.get(rid)!;
      result.set(rid, [r.x, r.y]);
      return false;
    }

    const r = activeMap.get(rid)!;
    inCall.add(rid);

    const candList = candidates(r);
    for (const [nx, ny] of candList) {
      const key = `${nx},${ny}`;
      const claimedBy = claimed.get(key);
      if (
        claimedBy !== undefined &&
        (priorities.get(claimedBy) ?? 0) > (priorities.get(rid) ?? 0)
      ) {
        continue;
      }

      const occ = curPos.get(key);
      if (occ !== undefined && occ !== rid) {
        if (!activeMap.has(occ)) {
          continue;
        }

        if (result.has(occ)) {
          const occMove = result.get(occ)!;
          if (occMove[0] !== nx || occMove[1] !== ny) {
            result.set(rid, [nx, ny]);
            claimed.set(key, rid);
            inCall.delete(rid);
            return true;
          } else {
            continue;
          }
        }

        if (inCall.has(occ)) {
          continue;
        }

        const oldPri = priorities.get(occ) ?? 0;
        priorities.set(occ, (priorities.get(rid) ?? 0) - 0.5);

        if (tryMove(occ, depth + 1)) {
          const occMove = result.get(occ);
          if (!occMove || occMove[0] !== nx || occMove[1] !== ny) {
            const isEmergPush = r.isEmergency || (emergencyRobotId !== undefined && emergencyRobotId !== null && r.id === emergencyRobotId);
            messages.push({
              type: isEmergPush ? 'emergency' : 'yield',
              msg: isEmergPush
                ? `🚨 R${occ} yields to clear Dynamic Emergency Corridor for R${rid}`
                : `R${occ} yields/reverses to clear intersection for R${rid}`,
            });
            result.set(rid, [nx, ny]);
            claimed.set(key, rid);
            inCall.delete(rid);
            return true;
          }
        }
        priorities.set(occ, oldPri);
      } else {
        result.set(rid, [nx, ny]);
        claimed.set(key, rid);
        inCall.delete(rid);
        return true;
      }
    }

    result.set(rid, [r.x, r.y]);
    claimed.set(`${r.x},${r.y}`, rid);
    inCall.delete(rid);
    return false;
  };

  const sortedActiveIds = Array.from(activeMap.keys()).sort(
    (a, b) => (priorities.get(b) ?? 0) - (priorities.get(a) ?? 0)
  );

  for (const rid of sortedActiveIds) {
    if (!result.has(rid)) {
      inCall.clear();
      tryMove(rid);
    }
  }

  // Detect route detours and reverse moves
  for (const [rid, move] of result.entries()) {
    const r = activeMap.get(rid);
    if (r && r.path && r.pathIdx + 1 < r.path.length) {
      const planned = r.path[r.pathIdx + 1];
      if (
        (move[0] !== planned[0] || move[1] !== planned[1]) &&
        (move[0] !== r.x || move[1] !== r.y)
      ) {
        messages.push({
          type: 'detour',
          msg: `R${rid} reverses/detours to avoid collision and recalculate path`,
        });
      }
    }
  }

  return { moves: result, messages };
}
