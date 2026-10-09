import { Robot, State } from './Robot';

export interface ConflictPrediction {
  robot_a: number;
  robot_b: number;
  cell: [number, number];
  ticks_away: number;
  type: 'vertex' | 'swap';
  confidence: number;
}

export function predictConflicts(robots: Robot[], lookahead = 8): ConflictPrediction[] {
  const active = robots.filter(
    r => (r.state === State.MOVING || r.state === State.WAITING) && r.path && r.path.length > 0
  );
  const conflicts: ConflictPrediction[] = [];

  for (let i = 0; i < active.length; i++) {
    const r1 = active[i];
    const p1 = r1.path.slice(r1.pathIdx, r1.pathIdx + lookahead);

    for (let j = i + 1; j < active.length; j++) {
      const r2 = active[j];
      const p2 = r2.path.slice(r2.pathIdx, r2.pathIdx + lookahead);
      const n = Math.min(p1.length, p2.length);

      for (let step = 0; step < n; step++) {
        // Vertex conflict
        if (p1[step][0] === p2[step][0] && p1[step][1] === p2[step][1]) {
          conflicts.push({
            robot_a: r1.id,
            robot_b: r2.id,
            cell: [p1[step][0], p1[step][1]],
            ticks_away: step + 1,
            type: 'vertex',
            confidence: Number(Math.max(0.2, 1.0 - step * 0.1).toFixed(2)),
          });
          break;
        }

        // Swap conflict
        if (
          step > 0 &&
          p1[step][0] === p2[step - 1][0] &&
          p1[step][1] === p2[step - 1][1] &&
          p2[step][0] === p1[step - 1][0] &&
          p2[step][1] === p1[step - 1][1]
        ) {
          conflicts.push({
            robot_a: r1.id,
            robot_b: r2.id,
            cell: [p1[step][0], p1[step][1]],
            ticks_away: step,
            type: 'swap',
            confidence: 0.95,
          });
          break;
        }
      }
    }
  }

  conflicts.sort((a, b) => b.confidence / Math.max(1, a.ticks_away) - a.confidence / Math.max(1, b.ticks_away));
  return conflicts.slice(0, 5);
}
