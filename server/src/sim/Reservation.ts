export class ReservationTable {
  private table: Map<string, number> = new Map();
  private owned: Map<number, Set<string>> = new Map();

  private makeKey(x: number, y: number, t: number): string {
    return `${x},${y},${t}`;
  }

  claim(x: number, y: number, t: number, robotId: number): void {
    const key = this.makeKey(x, y, t);
    this.table.set(key, robotId);

    if (!this.owned.has(robotId)) {
      this.owned.set(robotId, new Set());
    }
    this.owned.get(robotId)!.add(key);
  }

  isReserved(x: number, y: number, t: number, ignoreRobotId?: number): boolean {
    const key = this.makeKey(x, y, t);
    const v = this.table.get(key);
    return v !== undefined && v !== ignoreRobotId;
  }

  isSwapConflict(x1: number, y1: number, x2: number, y2: number, t: number, ignoreRobotId?: number): boolean {
    const occT = this.table.get(this.makeKey(x2, y2, t));
    const occT1 = this.table.get(this.makeKey(x1, y1, t + 1));
    if (occT === undefined || occT === ignoreRobotId) {
      return false;
    }
    return occT === occT1;
  }

  release(robotId: number): void {
    const keys = this.owned.get(robotId);
    if (keys) {
      for (const k of keys) {
        this.table.delete(k);
      }
      this.owned.delete(robotId);
    }
  }

  releaseBefore(t: number): void {
    for (const [k, rid] of this.table.entries()) {
      const parts = k.split(',');
      const time = parseInt(parts[2], 10);
      if (time < t) {
        this.table.delete(k);
        const set = this.owned.get(rid);
        if (set) {
          set.delete(k);
        }
      }
    }
  }

  clear(): void {
    this.table.clear();
    this.owned.clear();
  }
}
