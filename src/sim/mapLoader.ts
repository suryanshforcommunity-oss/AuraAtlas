import { GridData } from '../types/fleet';
import { BUNDLED_MAPS } from './mapsData';

export const FREE = 0;
export const OBSTACLE = 1;

/**
 * Creates the standard structured pod warehouse map (the default "custom" map on localhost)
 * Dimensions: 24 columns × 34 rows with 20 double-deep storage rack pods, perimeter aisles,
 * pick stations along bottom, drop docks along top, and charging stations.
 */
export function createCustomWarehouseGrid(): GridData {
  const shelf_rows = 4;
  const shelf_cols = 5;
  const shelf_len = 5;
  const shelf_w = 2;
  const aisle = 2;

  const col_stride = shelf_w + aisle; // 4
  const row_stride = shelf_len + aisle; // 7
  const border = 2;
  const W = border * 2 + shelf_cols * col_stride; // 24
  const H = border * 2 + 2 + shelf_rows * row_stride; // 34

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

  const pick_stations: [number, number][] = [];
  const drop_stations: [number, number][] = [];

  for (let c = 0; c < shelf_cols; c++) {
    const cx = border + c * col_stride + Math.floor(shelf_w / 2);
    pick_stations.push([cx, H - border]);
    if (cx + 1 < W - border) pick_stations.push([cx + 1, H - border]);
    drop_stations.push([cx, border - 1]);
    if (cx + 1 < W - border) drop_stations.push([cx + 1, border - 1]);
  }

  const charging_stations: [number, number][] = [
    [1, Math.floor(H / 2)],
    [W - 2, Math.floor(H / 2)],
    [Math.floor(W / 2), border - 1],
    [Math.floor(W / 2), H - border],
  ];

  return {
    width: W,
    height: H,
    cells,
    pick_stations,
    drop_stations,
    charging_stations,
  };
}

/**
 * Parses a standard MovingAI .map format string into a GridData object
 */
export function parseMovingAIMap(content: string, countStations = 8): GridData {
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

  const isFree = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h && cells[y][x] === FREE;

  // Scan stations
  const scanRow = (yRange: number[]): [number, number][] => {
    for (const y of yRange) {
      const row: [number, number][] = [];
      for (let x = 0; x < w; x++) {
        if (isFree(x, y)) row.push([x, y]);
      }
      if (row.length > 0) {
        const step = Math.max(1, Math.floor(row.length / countStations));
        const res: [number, number][] = [];
        for (let i = 0; i < row.length && res.length < countStations; i += step) {
          res.push(row[i]);
        }
        return res;
      }
    }
    return [];
  };

  const bottomHalf: number[] = [];
  for (let y = h - 1; y >= Math.floor(h / 2); y--) bottomHalf.push(y);

  const topHalf: number[] = [];
  for (let y = 0; y < Math.floor(h / 2); y++) topHalf.push(y);

  let picks = scanRow(bottomHalf);
  let drops = scanRow(topHalf);

  if (picks.length === 0) {
    const allFree: [number, number][] = [];
    for (let y = h - 1; y >= 0; y--) {
      for (let x = 0; x < w; x++) {
        if (isFree(x, y)) allFree.push([x, y]);
      }
    }
    picks = allFree.slice(0, countStations);
  }

  if (drops.length === 0) {
    const allFree: [number, number][] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (isFree(x, y)) allFree.push([x, y]);
      }
    }
    drops = allFree.slice(0, countStations);
  }

  const charging_stations: [number, number][] = [];
  for (const x of [1, w - 2, Math.floor(w / 2)]) {
    for (const y of [Math.floor(h / 2) - 1, Math.floor(h / 2) + 1]) {
      if (isFree(x, y) && charging_stations.length < 4) {
        charging_stations.push([x, y]);
      }
    }
  }

  return {
    width: w,
    height: h,
    cells,
    pick_stations: picks,
    drop_stations: drops,
    charging_stations,
  };
}

/**
 * Loads any map by ID/Name, either from pre-bundled MovingAI maps or default structured pod warehouse
 */
export function loadGridByName(mapName: string): GridData {
  if (mapName === 'custom' || !mapName) {
    return createCustomWarehouseGrid();
  }

  if (BUNDLED_MAPS[mapName]) {
    return parseMovingAIMap(BUNDLED_MAPS[mapName]);
  }

  // If mapName has .map suffix stripped or formatted
  const stripped = mapName.replace('.map', '');
  if (BUNDLED_MAPS[stripped]) {
    return parseMovingAIMap(BUNDLED_MAPS[stripped]);
  }

  // Fallback to custom
  return createCustomWarehouseGrid();
}
