export interface PerformanceDict {
  throughput_100: number;
  avg_delivery: number;
  conflicts: number;
  replans: number;
  total_deliveries: number;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  v: number;
}

export class PerformanceTracker {
  deliveryTimes: number[] = [];
  conflicts = 0;
  replans = 0;
  heatmap: Map<string, number> = new Map();

  recordDelivery(t: number): void {
    this.deliveryTimes.push(t);
  }

  recordConflict(): void {
    this.conflicts++;
  }

  recordReplan(): void {
    this.replans++;
  }

  visit(x: number, y: number): void {
    const key = `${x},${y}`;
    this.heatmap.set(key, (this.heatmap.get(key) || 0) + 1);
  }

  avgDelivery(): number {
    const recent = this.deliveryTimes.slice(-20);
    if (recent.length === 0) return 0;
    const sum = recent.reduce((acc, curr) => acc + curr, 0);
    return Number((sum / recent.length).toFixed(1));
  }

  throughput100(tick: number): number {
    if (!tick) return 0;
    return Number(((this.deliveryTimes.length / tick) * 100).toFixed(1));
  }

  heatmapTop(n = 80): HeatmapPoint[] {
    if (this.heatmap.size === 0) return [];
    let mx = 0;
    for (const val of this.heatmap.values()) {
      if (val > mx) mx = val;
    }
    if (mx === 0) return [];

    const entries = Array.from(this.heatmap.entries()).sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, n);

    return top.map(([key, v]) => {
      const [x, y] = key.split(',').map(Number);
      return {
        x,
        y,
        v: Number((v / mx).toFixed(3)),
      };
    });
  }

  toDict(tick: number): PerformanceDict {
    return {
      throughput_100: this.throughput100(tick),
      avg_delivery: this.avgDelivery(),
      conflicts: this.conflicts,
      replans: this.replans,
      total_deliveries: this.deliveryTimes.length,
    };
  }

  reset(): void {
    this.deliveryTimes = [];
    this.conflicts = 0;
    this.replans = 0;
    this.heatmap.clear();
  }
}
