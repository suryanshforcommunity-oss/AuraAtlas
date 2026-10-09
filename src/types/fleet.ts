export interface GridData {
  width: number;
  height: number;
  cells: number[][];
  pick_stations: [number, number][];
  drop_stations: [number, number][];
  charging_stations?: [number, number][];
}

export interface RobotData {
  id: number;
  x: number;
  y: number;
  color: string;
  state: 'idle' | 'moving' | 'waiting' | 'failed' | 'charging' | string;
  phase: 'pickup' | 'dropoff' | 'charging' | null | string;
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

export interface StationData {
  id: number;
  x: number;
  y: number;
  type: 'pick' | 'drop';
  current: number;
  max: number;
  priority: number;
  pct: number;
}

export interface HiveMessage {
  type: 'yield' | 'detour' | 'pickup' | 'delivery' | 'auction' | 'restock' | 'fail' | 'job_finished' | 'emergency' | string;
  msg: string;
}

export interface ConflictData {
  robot_a: number;
  robot_b: number;
  cell: [number, number];
  ticks_away: number;
  type: 'vertex' | 'swap';
  confidence: number;
}

export interface PerformanceData {
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

export interface MetricsData {
  throughput: number;
  active: number;
  idle: number;
  failed: number;
  charging?: number;
}

export type EmergencyStatus =
  | 'inactive'
  | 'planning'
  | 'awaiting_clearance'
  | 'active'
  | 'replanning'
  | 'completed'
  | 'released'
  | 'failed';

export interface EmergencyCorridorData {
  active: boolean;
  status: EmergencyStatus;
  robotId: number | null;
  destination: [number, number] | null;
  pickup?: [number, number] | null;
  dropoff?: [number, number] | null;
  phase?: 'to_pickup' | 'to_dropoff' | 'delivered' | null;
  route: [number, number][];
  fullRoute?: [number, number][];
  reservedCells: [number, number][];
  intersections: [number, number][];
  yieldingRobots: number[];
  reroutedRobots: number[];
  message?: string;
  startTick?: number;
}

export interface SimulationState {
  tick: number;
  running: boolean;
  job_finished?: boolean;
  total_pick_stock?: number;
  robots: RobotData[];
  stations: StationData[];
  hive_mind: HiveMessage[];
  conflicts: ConflictData[];
  performance: PerformanceData;
  heatmap: HeatmapPoint[];
  events: string[];
  metrics: MetricsData;
  grid?: GridData;
  emergency?: EmergencyCorridorData;
}
