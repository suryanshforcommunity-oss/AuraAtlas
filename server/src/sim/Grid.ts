export const OBSTACLE = 1;
export const FREE = 0;

export interface GridDict {
  width: number;
  height: number;
  cells: number[][];
  pick_stations: [number, number][];
  drop_stations: [number, number][];
  charging_stations: [number, number][];
}

export class Grid {
  width: number;
  height: number;
  cells: number[][];
  pick_stations: [number, number][];
  drop_stations: [number, number][];
  charging_stations: [number, number][];
  userBlockedCells: Set<string>;

  constructor(
    width: number,
    height: number,
    cells: number[][],
    pick_stations: [number, number][] = [],
    drop_stations: [number, number][] = [],
    charging_stations: [number, number][] = []
  ) {
    this.width = width;
    this.height = height;
    this.cells = cells.map(row => [...row]);
    this.pick_stations = pick_stations;
    this.drop_stations = drop_stations;
    this.charging_stations = charging_stations;
    this.userBlockedCells = new Set();
  }

  isFree(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    return this.cells[y][x] === FREE;
  }

  blockCell(x: number, y: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.cells[y][x] = OBSTACLE;
      this.userBlockedCells.add(`${x},${y}`);
    }
  }

  unblockCell(x: number, y: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.cells[y][x] = FREE;
      this.userBlockedCells.delete(`${x},${y}`);
    }
  }

  clearUserBlocks(): void {
    for (const key of this.userBlockedCells) {
      const [x, y] = key.split(',').map(Number);
      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        this.cells[y][x] = FREE;
      }
    }
    this.userBlockedCells.clear();
  }

  toggleCell(x: number, y: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      if (this.cells[y][x] === FREE) {
        this.blockCell(x, y);
      } else {
        this.unblockCell(x, y);
      }
    }
  }

  getNeighbors(x: number, y: number): [number, number][] {
    const neighbors: [number, number][] = [];
    const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.isFree(nx, ny)) {
        neighbors.push([nx, ny]);
      }
    }
    return neighbors;
  }

  toDict(): GridDict {
    return {
      width: this.width,
      height: this.height,
      cells: this.cells,
      pick_stations: this.pick_stations,
      drop_stations: this.drop_stations,
      charging_stations: this.charging_stations,
    };
  }
}

export function autoChargingStations(grid: Grid, count: number): [number, number][] {
  const stations: [number, number][] = [];
  const occupied = new Set<string>();

  (grid.pick_stations || []).forEach(p => occupied.add(`${p[0]},${p[1]}`));
  (grid.drop_stations || []).forEach(d => occupied.add(`${d[0]},${d[1]}`));

  // Scan left and right vertical edges or mid rows for charging pads
  const candidates: [number, number][] = [];

  // Edge columns (x = 1 or x = width - 2)
  for (let y = 1; y < grid.height - 1; y++) {
    for (const x of [1, grid.width - 2, Math.floor(grid.width / 2)]) {
      if (grid.isFree(x, y) && !occupied.has(`${x},${y}`)) {
        candidates.push([x, y]);
        occupied.add(`${x},${y}`);
      }
    }
  }

  // Fallback to any free cells
  if (candidates.length < count) {
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.isFree(x, y) && !occupied.has(`${x},${y}`)) {
          candidates.push([x, y]);
          occupied.add(`${x},${y}`);
        }
      }
    }
  }

  const step = Math.max(1, Math.floor(candidates.length / count));
  for (let i = 0; i < candidates.length && stations.length < count; i += step) {
    stations.push(candidates[i]);
  }

  while (stations.length < count && candidates.length > stations.length) {
    stations.push(candidates[stations.length]);
  }

  return stations;
}

export function createWarehouse(
  shelf_rows = 4,
  shelf_cols = 5,
  shelf_len = 5,
  shelf_w = 2,
  aisle = 2
): Grid {
  const col_stride = shelf_w + aisle;
  const row_stride = shelf_len + aisle;
  const border = 2;
  const W = border * 2 + shelf_cols * col_stride;
  const H = border * 2 + 2 + shelf_rows * row_stride;
  const cells: number[][] = Array.from({ length: H }, () => Array(W).fill(FREE));
  const shelf_y0 = border + 1;

  for (let r = 0; r < shelf_rows; r++) {
    for (let c = 0; c < shelf_cols; c++) {
      const y0 = shelf_y0 + r * row_stride;
      const x0 = border + c * col_stride;
      for (let sy = 0; sy < shelf_len; sy++) {
        for (let sx = 0; sx < shelf_w; sx++) {
          if (y0 + sy < H - border && x0 + sx < W - border) {
            cells[y0 + sy][x0 + sx] = OBSTACLE;
          }
        }
      }
    }
  }

  const picks: [number, number][] = [];
  const drops: [number, number][] = [];

  for (let c = 0; c < shelf_cols; c++) {
    const cx = border + c * col_stride + Math.floor(shelf_w / 2);
    picks.push([cx, H - border]);
    if (cx + 1 < W - border) picks.push([cx + 1, H - border]);
    drops.push([cx, border - 1]);
    if (cx + 1 < W - border) drops.push([cx + 1, border - 1]);
  }

  return new Grid(W, H, cells, picks, drops);
}

export function generateBenchmarkMapContent(mapName: string): string {
  let w = 32;
  let h = 32;

  if (mapName.includes('20-40')) {
    w = 48;
    h = 32;
  } else if (mapName.includes('10-20')) {
    w = 36;
    h = 24;
  } else if (mapName.includes('32-32')) {
    w = 32;
    h = 32;
  }

  const lines = ['type octile', `height ${h}`, `width ${w}`, 'map'];

  if (mapName.startsWith('maze')) {
    const grid: string[][] = Array.from({ length: h }, () => Array(w).fill('.'));

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
          grid[y][x] = '@';
          continue;
        }

        if (x % 2 === 0 && y % 2 === 0) {
          grid[y][x] = '@';
          const dir = (x * 7 + y * 13) % 4;
          if (dir === 0 && y > 1) grid[y - 1][x] = '@';
          else if (dir === 1 && x < w - 2) grid[y][x + 1] = '@';
          else if (dir === 2 && y < h - 2) grid[y + 1][x] = '@';
          else if (dir === 3 && x > 1) grid[y][x - 1] = '@';
        }

        if ((x % 6 === 3 && y % 4 === 1) || (x % 5 === 1 && y % 6 === 3)) {
          grid[y][x] = '@';
        }
      }
    }

    for (let x = 1; x < w - 1; x++) {
      grid[1][x] = '.';
      grid[h - 2][x] = '.';
      grid[2][x] = '.';
      grid[h - 3][x] = '.';
    }

    for (let y = 0; y < h; y++) {
      lines.push(grid[y].join(''));
    }
  } else if (mapName.startsWith('warehouse')) {
    const grid: string[][] = Array.from({ length: h }, () => Array(w).fill('.'));
    const podW = 2;
    const podH = 5;
    const strideX = 4;
    const strideY = 7;

    for (let y = 3; y < h - 3; y++) {
      for (let x = 3; x < w - 3; x++) {
        const relX = (x - 3) % strideX;
        const relY = (y - 3) % strideY;
        if (relX < podW && relY < podH) {
          grid[y][x] = '@';
        }
      }
    }

    for (let y = 0; y < h; y++) {
      lines.push(grid[y].join(''));
    }
  } else if (mapName.startsWith('random')) {
    const grid: string[][] = Array.from({ length: h }, () => Array(w).fill('.'));
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const seed = (x * 17 + y * 31 + x * y * 7) % 100;
        if (seed < 22) {
          grid[y][x] = '@';
        }
      }
    }
    for (let y = 0; y < h; y++) {
      lines.push(grid[y].join(''));
    }
  } else {
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++) {
        row += '.';
      }
      lines.push(row);
    }
  }

  return lines.join('\n');
}

export function loadMovingAIMap(content: string): Grid {
  const lines = content.split('\n');
  let h = 0;
  let w = 0;
  let startIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('height')) {
      h = parseInt(line.split(/\s+/)[1], 10);
    } else if (line.startsWith('width')) {
      w = parseInt(line.split(/\s+/)[1], 10);
    } else if (line === 'map') {
      startIdx = i + 1;
      break;
    }
  }

  const cells: number[][] = Array.from({ length: h }, () => Array(w).fill(FREE));
  for (let y = 0; y < h; y++) {
    const line = lines[startIdx + y] || '';
    for (let x = 0; x < w; x++) {
      const ch = line[x];
      if (ch === '@' || ch === 'T' || ch === 'O' || ch === 'S') {
        cells[y][x] = OBSTACLE;
      }
    }
  }

  return new Grid(w, h, cells);
}

export function autoStations(grid: Grid, count = 8): { picks: [number, number][]; drops: [number, number][] } {
  const scanRow = (yRange: number[]): [number, number][] => {
    for (const y of yRange) {
      const row: [number, number][] = [];
      for (let x = 0; x < grid.width; x++) {
        if (grid.isFree(x, y)) row.push([x, y]);
      }
      if (row.length > 0) {
        const step = Math.max(1, Math.floor(row.length / count));
        const res: [number, number][] = [];
        for (let i = 0; i < row.length && res.length < count; i += step) {
          res.push(row[i]);
        }
        return res;
      }
    }
    return [];
  };

  const bottomHalf: number[] = [];
  for (let y = grid.height - 1; y >= Math.floor(grid.height / 2); y--) bottomHalf.push(y);
  
  const topHalf: number[] = [];
  for (let y = 0; y < Math.floor(grid.height / 2); y++) topHalf.push(y);

  let picks = scanRow(bottomHalf);
  let drops = scanRow(topHalf);

  if (picks.length === 0) {
    const allFree: [number, number][] = [];
    for (let y = grid.height - 1; y >= 0; y--) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.isFree(x, y)) allFree.push([x, y]);
      }
    }
    picks = allFree.slice(0, count);
  }

  if (drops.length === 0) {
    const allFree: [number, number][] = [];
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.isFree(x, y)) allFree.push([x, y]);
      }
    }
    drops = allFree.slice(0, count);
  }

  return { picks, drops };
}
