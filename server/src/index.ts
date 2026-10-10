import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { Simulator, SimulatorState } from './sim/Simulator';
import { loadMovingAIMap, autoStations, Grid, generateBenchmarkMapContent } from './sim/Grid';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

const MAPS_DIR = path.join(__dirname, '../maps');
if (!fs.existsSync(MAPS_DIR)) {
  fs.mkdirSync(MAPS_DIR, { recursive: true });
}

let sim = new Simulator();
const clients = new Set<WebSocket>();

function broadcast(state: SimulatorState): void {
  const payload = JSON.stringify(state);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// WebSocket setup
wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);
  const initialState = sim.stateDict();
  initialState.grid = sim.grid.toDict();
  ws.send(JSON.stringify(initialState));

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.action === 'start') {
        sim.start(broadcast);
        broadcast(sim.stateDict());
      } else if (data.action === 'pause') {
        sim.pause();
        broadcast(sim.stateDict());
      } else if (data.action === 'step') {
        sim.step();
        const s = sim.stateDict();
        s.grid = sim.grid.toDict();
        broadcast(s);
      } else if (data.action === 'reset') {
        sim.reset();
        const s = sim.stateDict();
        s.grid = sim.grid.toDict();
        broadcast(s);
      }
    } catch (e) {
      console.error('WebSocket msg error:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

// REST Controllers
app.post('/api/control/start', (_req: Request, res: Response) => {
  sim.start(broadcast);
  const state = sim.stateDict();
  state.grid = sim.grid.toDict();
  broadcast(state);
  res.json({ ok: true });
});

app.post('/api/control/pause', (_req: Request, res: Response) => {
  sim.pause();
  const state = sim.stateDict();
  state.grid = sim.grid.toDict();
  broadcast(state);
  res.json({ ok: true });
});

app.post('/api/control/reset', (_req: Request, res: Response) => {
  sim.reset();
  const state = sim.stateDict();
  state.grid = sim.grid.toDict();
  broadcast(state);
  res.json({ ok: true });
});

app.post('/api/control/step', (_req: Request, res: Response) => {
  sim.step();
  const state = sim.stateDict();
  state.grid = sim.grid.toDict();
  broadcast(state);
  res.json({ ok: true });
});

app.post('/api/event/block', (req: Request, res: Response) => {
  const { x, y } = req.body;
  if (typeof x === 'number' && typeof y === 'number') {
    sim.blockCell(x, y);
    const state = sim.stateDict();
    state.grid = sim.grid.toDict();
    broadcast(state);
    res.json({ ok: true });
  } else {
    res.status(400).json({ ok: false, error: 'Invalid coordinates' });
  }
});

app.post('/api/event/unblock', (req: Request, res: Response) => {
  const { x, y } = req.body;
  if (typeof x === 'number' && typeof y === 'number') {
    sim.unblockCell(x, y);
    const state = sim.stateDict();
    state.grid = sim.grid.toDict();
    broadcast(state);
    res.json({ ok: true });
  } else {
    res.status(400).json({ ok: false, error: 'Invalid coordinates' });
  }
});

app.post('/api/event/clear-blocks', (_req: Request, res: Response) => {
  sim.clearBlocks();
  const state = sim.stateDict();
  state.grid = sim.grid.toDict();
  broadcast(state);
  res.json({ ok: true });
});

app.post('/api/station/:sid/refill', (req: Request, res: Response) => {
  const sid = parseInt(req.params.sid, 10);
  const qty = req.body.qty || 4;
  const priority = req.body.priority;
  const ok = sim.refillStation(sid, qty, priority);
  const state = sim.stateDict();
  state.grid = sim.grid.toDict();
  broadcast(state);
  res.json({ ok });
});

app.post('/api/event/fail/:rid', (req: Request, res: Response) => {
  const rid = parseInt(req.params.rid, 10);
  sim.failRobot(rid);
  const state = sim.stateDict();
  state.grid = sim.grid.toDict();
  broadcast(state);
  res.json({ ok: true });
});

app.post('/api/event/order', (req: Request, res: Response) => {
  const priority = req.body.priority || 1;
  const qty = req.body.qty || 1;
  sim.addOrder(priority, qty);
  const state = sim.stateDict();
  broadcast(state);
  res.json({ ok: true });
});

app.post('/api/station/:sid/priority', (req: Request, res: Response) => {
  const sid = parseInt(req.params.sid, 10);
  const priority = req.body.priority || 1;
  const ok = sim.setStationPriority(sid, priority);
  const state = sim.stateDict();
  broadcast(state);
  res.json({ ok });
});

// Emergency Corridor API Endpoints
app.post('/api/emergency/preview', (req: Request, res: Response) => {
  const { robotId, pickupX, pickupY, dropoffX, dropoffY, targetX, targetY } = req.body;
  const pX = typeof pickupX === 'number' ? pickupX : targetX;
  const pY = typeof pickupY === 'number' ? pickupY : targetY;
  const dX = typeof dropoffX === 'number' ? dropoffX : undefined;
  const dY = typeof dropoffY === 'number' ? dropoffY : undefined;

  if (typeof robotId !== 'number' || typeof pX !== 'number' || typeof pY !== 'number') {
    res.status(400).json({ ok: false, error: 'Invalid parameters: robotId, pickupX, pickupY required' });
    return;
  }
  const dropoff = dX !== undefined && dY !== undefined ? [dX, dY] as [number, number] : undefined;
  const result = sim.previewEmergencyCorridor(robotId, [pX, pY], dropoff);
  res.json(result);
});

app.post('/api/emergency/activate', (req: Request, res: Response) => {
  const { robotId, pickupX, pickupY, dropoffX, dropoffY, targetX, targetY } = req.body;
  const pX = typeof pickupX === 'number' ? pickupX : targetX;
  const pY = typeof pickupY === 'number' ? pickupY : targetY;
  const dX = typeof dropoffX === 'number' ? dropoffX : undefined;
  const dY = typeof dropoffY === 'number' ? dropoffY : undefined;

  if (typeof robotId !== 'number' || typeof pX !== 'number' || typeof pY !== 'number') {
    res.status(400).json({ ok: false, error: 'Invalid parameters: robotId, pickupX, pickupY required' });
    return;
  }
  const dropoff = dX !== undefined && dY !== undefined ? [dX, dY] as [number, number] : undefined;
  const result = sim.activateEmergencyCorridor(robotId, [pX, pY], dropoff);
  const state = sim.stateDict();
  broadcast(state);
  res.json(result);
});

app.post('/api/emergency/cancel', (_req: Request, res: Response) => {
  sim.cancelEmergencyCorridor();
  const state = sim.stateDict();
  broadcast(state);
  res.json({ ok: true });
});

app.get('/api/map/available', (_req: Request, res: Response) => {
  const files = fs.readdirSync(MAPS_DIR).filter(f => f.endsWith('.map')).map(f => f.replace('.map', ''));
  const benchmarks = [
    'warehouse-10-20-10-2-1',
    'warehouse-10-20-10-2-2',
    'warehouse-20-40-10-2-1',
    'maze-32-32-2',
    'random-32-32-10',
    'empty-32-32'
  ];
  const allMaps = Array.from(new Set(['custom', ...files, ...benchmarks]));
  res.json({ maps: allMaps });
});

app.post('/api/map/download/:name', (req: Request, res: Response) => {
  const name = req.params.name;
  if (name === 'custom') {
    res.json({ ok: true, message: 'Custom map needs no download' });
    return;
  }

  const mapPath = path.join(MAPS_DIR, `${name}.map`);
  const mapContent = generateBenchmarkMapContent(name);
  fs.writeFileSync(mapPath, mapContent, 'utf-8');
  res.json({ ok: true, message: `Benchmark map ${name} initialized` });
});

app.post('/api/map/switch', (req: Request, res: Response) => {
  const { map_name, num_robots, robot_capacity } = req.body;
  const numR = num_robots || 5;
  const rCap = robot_capacity || 1;

  sim.pause();

  if (map_name === 'custom') {
    sim = new Simulator(undefined, numR, rCap);
  } else {
    const mapPath = path.join(MAPS_DIR, `${map_name}.map`);
    if (!fs.existsSync(mapPath)) {
      const content = generateBenchmarkMapContent(map_name);
      fs.writeFileSync(mapPath, content, 'utf-8');
    }

    let content = fs.readFileSync(mapPath, 'utf-8');
    if (!content || content.trim().length === 0) {
      content = generateBenchmarkMapContent(map_name);
      fs.writeFileSync(mapPath, content, 'utf-8');
    }

    const grid = loadMovingAIMap(content);
    const { picks, drops } = autoStations(grid, Math.max(4, Math.floor(numR / 3)));
    grid.pick_stations = picks;
    grid.drop_stations = drops;
    sim = new Simulator(grid, numR, rCap);
  }

  const state = sim.stateDict();
  state.grid = sim.grid.toDict();
  broadcast(state);
  res.json({ ok: true });
});

// ==========================================
// AURA EdgeAI Local Integration Endpoints
// ==========================================
const EDGE_AI_URL = process.env.EDGE_AI_URL || 'http://127.0.0.1:8001';

app.get('/api/edge/status', async (_req: Request, res: Response) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${EDGE_AI_URL}/edge/status`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: 'Edge AI response error' });
    }
    const data = await response.json();
    res.json({ ok: true, connected: true, ...data });
  } catch (err: any) {
    res.json({ ok: false, connected: false, message: 'AURA EdgeAI offline or unreachable on ' + EDGE_AI_URL });
  }
});

app.post('/api/edge/step', async (_req: Request, res: Response) => {
  try {
    const response = await fetch(`${EDGE_AI_URL}/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    res.json({ ok: true, ...data });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.post('/api/edge/offline/:enabled', async (req: Request, res: Response) => {
  try {
    const enabled = req.params.enabled === 'true';
    const response = await fetch(`${EDGE_AI_URL}/offline/${enabled}`, {
      method: 'POST'
    });
    const data = await response.json();
    res.json({ ok: true, ...data });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.post('/api/edge/reset', async (_req: Request, res: Response) => {
  try {
    const response = await fetch(`${EDGE_AI_URL}/reset`, { method: 'POST' });
    const data = await response.json();
    res.json({ ok: true, ...data });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// Serve frontend dist static assets
const DIST_DIR = path.resolve(__dirname, '../../dist');
app.use(express.static(DIST_DIR));
app.get('*', (req: Request, res: Response, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`<!DOCTYPE html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`);
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`⚡ FleetSync TS Server running on http://localhost:${PORT}`);
});
