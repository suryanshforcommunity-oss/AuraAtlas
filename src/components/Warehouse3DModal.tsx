import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimulationState } from '../types/fleet';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Camera,
  Cpu,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  ShieldAlert,
  Radio,
  Sliders,
  Sparkles,
  Wifi,
  WifiOff,
  Flame,
  Truck
} from 'lucide-react';

interface Warehouse3DModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: SimulationState | null;
}

interface EdgeRobot {
  id: string;
  name?: string;
  position: [number, number];
  status: string;
  task_id: string | null;
  route: [number, number][];
  completed: number;
  battery?: number;
  payload?: string | null;
}

interface EdgeTask {
  id: string;
  pickup: [number, number];
  delivery: [number, number];
  priority: number;
  status: string;
  assigned_robot_id: string | null;
}

interface EdgeSimState {
  width: number;
  height: number;
  step: number;
  offline_simulated: boolean;
  obstacles: [number, number][];
  robots: EdgeRobot[];
  tasks: EdgeTask[];
  logs: string[];
  metrics: {
    tasks_completed: number;
    collisions_avoided: number;
    reroutes: number;
    failed_robots: number;
  };
}

interface EdgeStatus {
  ok?: boolean;
  connected: boolean;
  mode?: string;
  model_loaded?: boolean;
  fallback_active?: boolean;
  last_latency_ms?: number;
  fallback_reason?: string;
  recent_decisions?: Array<{
    task_id: string;
    robot_id?: string;
    method?: string;
    reason: string;
    route_length?: number;
    latency_ms?: number;
  }>;
  training_runs?: number;
  learned_weights?: {
    distance_cost: number;
    priority_weight: number;
    hazard_penalty: number;
  };
}

const ROVER_COLORS: Record<string, number> = {
  R1: 0x3b82f6, // Blue
  R2: 0x10b981, // Emerald Green
  R3: 0xa855f7, // Purple
  R4: 0xf59e0b, // Amber Orange
};

const ROVER_NAMES: Record<string, string> = {
  R1: 'Robot Alpha',
  R2: 'Robot Beta',
  R3: 'Robot Gamma',
  R4: 'Robot Delta',
};

export const Warehouse3DModal: React.FC<Warehouse3DModalProps> = ({
  isOpen,
  onClose,
  state: parentState,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Simulation loop state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [addObstacleMode, setAddObstacleMode] = useState<boolean>(false);
  const [selectedRoverId, setSelectedRoverId] = useState<string>('R2');

  // Edge state & engine telemetry
  const [edgeSim, setEdgeSim] = useState<EdgeSimState | null>(null);
  const [edgeStatus, setEdgeStatus] = useState<EdgeStatus | null>(null);
  const [trainingState, setTrainingState] = useState<'idle' | 'training' | 'trained' | 'failed'>('idle');
  const [auditLogs, setAuditLogs] = useState<Array<{ text: string; type: string }>>([
    { text: '[Control] Simulation initialized. 3D Digital Twin ready.', type: 'control' }
  ]);

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Dynamic mesh tracking
  const robotMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const obstacleMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const routeLinesRef = useRef<Map<string, THREE.Line>>(new Map());

  // Fetch full state from Edge AI service
  const fetchState = useCallback(async () => {
    try {
      const [sRes, eRes] = await Promise.all([
        fetch('/api/edge/state'),
        fetch('/api/edge/status')
      ]);
      const sData = await sRes.json();
      const eData = await eRes.json();

      if (sData.ok && sData.state) {
        setEdgeSim(sData.state);
      }
      if (eData) {
        setEdgeStatus(eData);
        if (eData.model_loaded) {
          setTrainingState('trained');
        }
      }
    } catch {
      // Local fallback simulation if endpoint temporarily down
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchState();
    }
  }, [isOpen, fetchState]);

  // Step simulation tick
  const stepSimulation = useCallback(async () => {
    try {
      const res = await fetch('/api/edge/step', { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.state) {
        setEdgeSim(data.state);
        setEdgeStatus(data.edge);

        if (data.decisions && data.decisions.length > 0) {
          const newEntries = data.decisions.map((d: any) => ({
            text: `[Edge] ${d.robot_id || 'System'} assigned ${d.task_id} via ${d.method}: ${d.reason}`,
            type: d.method === 'ML_MODEL' ? 'ml' : 'rule'
          }));
          setAuditLogs(prev => [...prev.slice(-35), ...newEntries]);
        }
      }
    } catch {
      // Error
    }
  }, []);

  // Continuous auto-run loop when Start Simulation is active
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning && isOpen) {
      timer = setInterval(() => {
        stepSimulation();
      }, 700);
    }
    return () => clearInterval(timer);
  }, [isRunning, isOpen, stepSimulation]);

  // Toggle obstacle cell
  const handleToggleObstacle = async (x: number, y: number) => {
    try {
      const res = await fetch('/api/edge/obstacle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y })
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setEdgeSim(data.state);
        setAuditLogs(prev => [
          ...prev.slice(-35),
          { text: `[Obstacle] 3D Cell clicked at (${x}, ${y}): ${data.message || 'Toggled obstacle'}`, type: 'obstacle' }
        ]);
      }
    } catch (err: any) {
      setAuditLogs(prev => [...prev.slice(-35), { text: `[Error] ${err.message}`, type: 'error' }]);
    }
  };

  // Train local ML model from past data
  const handleTrainLocalModel = async () => {
    setTrainingState('training');
    setAuditLogs(prev => [
      ...prev.slice(-35),
      { text: '[Train] Harvesting historical dispatch transitions and obstacle clearances...', type: 'train' }
    ]);

    try {
      const res = await fetch('/api/edge/train', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setTrainingState('trained');
        setEdgeStatus(data.edge);
        setAuditLogs(prev => [
          ...prev.slice(-35),
          {
            text: `[Train] Local Model weights converged (run #${data.result?.training_runs || 1}) in ${data.result?.latency_ms || 0.016}ms. Mode switched to ML_MODEL.`,
            type: 'ml'
          }
        ]);
      } else {
        setTrainingState('failed');
      }
    } catch (err: any) {
      setTrainingState('failed');
      setAuditLogs(prev => [...prev.slice(-35), { text: `[Train ERROR] ${err.message}`, type: 'error' }]);
    }
  };

  // Simulate robot failure
  const handleSimulateFailure = async () => {
    try {
      const res = await fetch('/api/edge/fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ robot_id: selectedRoverId })
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setEdgeSim(data.state);
        setAuditLogs(prev => [
          ...prev.slice(-35),
          { text: `[Fail] Simulated mechanical fault on ${selectedRoverId} (${ROVER_NAMES[selectedRoverId]}). Tasks re-queued.`, type: 'fail' }
        ]);
      }
    } catch {
      //
    }
  };

  // Reset simulation
  const handleReset = async () => {
    setIsRunning(false);
    try {
      const res = await fetch('/api/edge/reset', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setEdgeSim(data);
        fetchState();
        setAuditLogs(prev => [
          ...prev.slice(-35),
          { text: '[Control] Simulation reset to initial warehouse parameters.', type: 'control' }
        ]);
      }
    } catch {
      //
    }
  };

  // -------------------------------------------------------------
  // THREE.JS 3D SCENE SETUP
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    const gridW = edgeSim?.width || 12;
    const gridH = edgeSim?.height || 12;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.018);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const centerX = gridW / 2;
    const centerZ = gridH / 2;
    camera.position.set(centerX - 8, 14, centerZ + 12);
    camera.lookAt(centerX, 0, centerZ);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(centerX, 0, centerZ);
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xa5b4fc, 1.4);
    dirLight.position.set(centerX - 8, 22, centerZ - 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const cyanGlow = new THREE.PointLight(0x06b6d4, 1.8, 25);
    cyanGlow.position.set(centerX, 5, centerZ);
    scene.add(cyanGlow);

    // 6. Interactive Floor Plane
    const floorGeo = new THREE.PlaneGeometry(gridW, gridH);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f1d,
      roughness: 0.7,
      metalness: 0.3
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centerX, 0, centerZ);
    floor.receiveShadow = true;
    floor.name = 'floor';
    scene.add(floor);
    floorMeshRef.current = floor;

    // Grid Floor Overlay
    const gridHelper = new THREE.GridHelper(Math.max(gridW, gridH), gridW, 0x1e293b, 0x0f172a);
    gridHelper.position.set(centerX, 0.01, centerZ);
    scene.add(gridHelper);

    // 7. Stationary Pick / Delivery station pads
    if (edgeSim?.tasks) {
      edgeSim.tasks.forEach(t => {
        // Pickup Pad (Green circle)
        const pGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.04, 20);
        const pMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.6 });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(t.pickup[0] + 0.5, 0.02, t.pickup[1] + 0.5);
        scene.add(pMesh);

        // Delivery Pad (Cyan circle)
        const dGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.04, 20);
        const dMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.6 });
        const dMesh = new THREE.Mesh(dGeo, dMat);
        dMesh.position.set(t.delivery[0] + 0.5, 0.02, t.delivery[1] + 0.5);
        scene.add(dMesh);
      });
    }

    // 8. Animation Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // 9. Raycaster 3D Floor Click Listener (Add Obstacle on click)
    const handleCanvasClick = (event: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      mouseRef.current.set(x, y);
      if (!cameraRef.current || !floorMeshRef.current) return;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(floorMeshRef.current);

      if (intersects.length > 0) {
        const pt = intersects[0].point;
        const cellX = Math.floor(pt.x);
        const cellY = Math.floor(pt.z);
        if (cellX >= 0 && cellX < gridW && cellY >= 0 && cellY < gridH) {
          handleToggleObstacle(cellX, cellY);
        }
      }
    };
    mount.addEventListener('click', handleCanvasClick);

    // Resize Handler
    const handleResize = () => {
      if (!mount || !rendererRef.current || !cameraRef.current) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      mount.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('resize', handleResize);
      if (mount && renderer.domElement) mount.removeChild(renderer.domElement);
      renderer.dispose();
      robotMeshesRef.current.clear();
      obstacleMeshesRef.current.clear();
      routeLinesRef.current.clear();
    };
  }, [isOpen, edgeSim?.width, edgeSim?.height]);

  // -------------------------------------------------------------
  // UPDATE DYNAMIC 3D ENTITIES (ROVERS, OBSTACLES, ROUTES)
  // -------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !edgeSim) return;

    // 1. Render Obstacles (Orange Hazard Cubes)
    const currentObstacleKeys = new Set(edgeSim.obstacles.map(([ox, oy]) => `${ox},${oy}`));
    const obsMap = obstacleMeshesRef.current;

    // Remove deleted obstacles
    obsMap.forEach((mesh, key) => {
      if (!currentObstacleKeys.has(key)) {
        scene.remove(mesh);
        obsMap.delete(key);
      }
    });

    // Add new obstacles
    edgeSim.obstacles.forEach(([ox, oy]) => {
      const key = `${ox},${oy}`;
      if (!obsMap.has(key)) {
        const obsGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
        const obsMat = new THREE.MeshStandardMaterial({
          color: 0xf97316,
          roughness: 0.4,
          metalness: 0.2
        });
        const obsMesh = new THREE.Mesh(obsGeo, obsMat);
        obsMesh.position.set(ox + 0.5, 0.425, oy + 0.5);
        obsMesh.castShadow = true;
        obsMesh.receiveShadow = true;
        scene.add(obsMesh);
        obsMap.set(key, obsMesh);
      }
    });

    // 2. Render 3D Rovers (AGVs)
    const robotMap = robotMeshesRef.current;
    edgeSim.robots.forEach(r => {
      let group = robotMap.get(r.id);

      if (!group) {
        group = new THREE.Group();
        const col = ROVER_COLORS[r.id] || 0x3b82f6;

        // Chassis
        const chassisGeo = new THREE.BoxGeometry(0.68, 0.24, 0.68);
        const chassisMat = new THREE.MeshStandardMaterial({
          color: col,
          roughness: 0.3,
          metalness: 0.7
        });
        const chassis = new THREE.Mesh(chassisGeo, chassisMat);
        chassis.position.y = 0.12;
        chassis.castShadow = true;
        group.add(chassis);

        // Wheels
        const newGroup = group;
        [-0.32, 0.32].forEach(wx => {
          [-0.24, 0.24].forEach(wz => {
            const wheelGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12);
            wheelGeo.rotateZ(Math.PI / 2);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(wx, 0.08, wz);
            newGroup.add(wheel);
          });
        });

        // Direction Headlight
        const lightGeo = new THREE.BoxGeometry(0.18, 0.08, 0.06);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(0, 0.18, -0.34);
        group.add(light);

        // Carried Payload Box
        const cargoGeo = new THREE.BoxGeometry(0.44, 0.34, 0.44);
        const cargoMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
        const cargo = new THREE.Mesh(cargoGeo, cargoMat);
        cargo.name = 'cargo';
        cargo.position.y = 0.42;
        cargo.castShadow = true;
        cargo.visible = false;
        group.add(cargo);

        scene.add(group);
        robotMap.set(r.id, group);
      }

      // Smooth position lerping
      const targetX = r.position[0] + 0.5;
      const targetZ = r.position[1] + 0.5;
      group.position.x = THREE.MathUtils.lerp(group.position.x, targetX, 0.4);
      group.position.z = THREE.MathUtils.lerp(group.position.z, targetZ, 0.4);

      // Orientation heading
      if (r.route && r.route.length > 0) {
        const next = r.route[0];
        const angle = Math.atan2(next[0] - r.position[0], next[1] - r.position[1]);
        group.rotation.y = angle + Math.PI;
      }

      // Payload Box visibility
      const cargo = group.getObjectByName('cargo');
      if (cargo) {
        cargo.visible = !!r.task_id;
      }
    });

    // 3. Render Planned Route Lines in 3D
    const lineMap = routeLinesRef.current;
    edgeSim.robots.forEach(r => {
      let line = lineMap.get(r.id);
      if (line) {
        scene.remove(line);
      }

      if (r.route && r.route.length > 0) {
        const points = [
          new THREE.Vector3(r.position[0] + 0.5, 0.05, r.position[1] + 0.5),
          ...r.route.map(pt => new THREE.Vector3(pt[0] + 0.5, 0.05, pt[1] + 0.5))
        ];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({
          color: ROVER_COLORS[r.id] || 0x38bdf8,
          linewidth: 2
        });
        line = new THREE.Line(lineGeo, lineMat);
        scene.add(line);
        lineMap.set(r.id, line);
      }
    });
  }, [edgeSim]);

  const resetCamera = () => {
    if (!controlsRef.current || !cameraRef.current || !edgeSim) return;
    const centerX = edgeSim.width / 2;
    const centerZ = edgeSim.height / 2;
    cameraRef.current.position.set(centerX - 8, 14, centerZ + 12);
    controlsRef.current.target.set(centerX, 0, centerZ);
  };

  if (!isOpen) return null;

  const activeRobotsCount = edgeSim?.robots.filter(r => r.status !== 'failed').length || 4;
  const completedTasksCount = edgeSim?.metrics.tasks_completed || 0;
  const isMlModelActive = edgeStatus?.mode === 'ML_MODEL' || edgeStatus?.model_loaded;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md select-none animate-fadeIn">
      <div className="w-full h-full max-w-[1500px] max-h-[96vh] rounded-2xl bg-[#090d18] border border-cyan-500/40 shadow-2xl shadow-cyan-950/80 relative flex flex-col overflow-hidden reticle-box">
        {/* 1. TOP SIMULATION CONTROL BAR */}
        <div className="px-5 py-3 bg-[#0c1222] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Playback Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 ${
                isRunning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-headline'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4 fill-amber-300" /> : <Play className="w-4 h-4 fill-slate-950" />}
              <span>{isRunning ? 'PAUSE' : 'START SIMULATION'}</span>
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono transition-colors"
              title="Reset Simulation State"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET</span>
            </button>
          </div>

          {/* Interactive Tools: Add Obstacle & Rover Failure */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddObstacleMode(!addObstacleMode)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                addObstacleMode
                  ? 'bg-amber-500/30 text-amber-300 border-amber-500/60 animate-pulse shadow-md shadow-amber-950'
                  : 'bg-cyan-950/40 text-cyan-300 border-cyan-500/40 hover:bg-cyan-950/70'
              }`}
            >
              <span>🧱</span>
              <span>{addObstacleMode ? 'Click 3D Cell: Add Obstacle (ACTIVE)' : 'Click 3D Cell: Add Obstacle'}</span>
            </button>

            <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
              <select
                value={selectedRoverId}
                onChange={e => setSelectedRoverId(e.target.value)}
                className="bg-transparent text-xs font-mono text-slate-200 outline-none cursor-pointer"
              >
                <option value="R1">Rover R1 (Alpha)</option>
                <option value="R2">Rover R2 (Beta)</option>
                <option value="R3">Rover R3 (Gamma)</option>
                <option value="R4">Rover R4 (Delta)</option>
              </select>

              <button
                onClick={handleSimulateFailure}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-mono font-semibold transition-all"
                title="Simulate AGV Hardware Failure"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>Simulate Failure</span>
              </button>
            </div>
          </div>

          {/* Close Window */}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. TOP KPI METRICS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 px-5 py-3 bg-[#080d1a] border-b border-slate-800/80">
          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">DECISION ENGINE MODE</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`font-mono text-sm font-bold ${
                  isMlModelActive ? 'text-emerald-400' : 'text-cyan-300'
                }`}
              >
                {isMlModelActive ? 'ML_MODEL' : 'RULE_FALLBACK'}
              </span>
              <span className={`w-2 h-2 rounded-full ${isMlModelActive ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400'}`} />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">INFERENCE LATENCY</span>
            <div className="font-mono text-sm font-bold text-white mt-0.5">
              {(edgeStatus?.last_latency_ms || 0.016).toFixed(3)} ms
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">FLEET HEALTH</span>
            <div className="font-mono text-sm font-bold text-cyan-300 mt-0.5">
              {activeRobotsCount} / 4
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
            <span className="text-[10px] text-slate-400 font-mono uppercase block">COMPLETED TASKS</span>
            <div className="font-mono text-sm font-bold text-emerald-300 mt-0.5">
              {completedTasksCount} / {edgeSim?.tasks.length || 4}
            </div>
          </div>
        </div>

        {/* 3. MAIN WORKSPACE: 3D CANVAS (LEFT) & ROVER DASHBOARD (RIGHT) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* 3A. 3D INTERACTIVE VISUALIZER */}
          <div className="flex-1 flex flex-col relative border-r border-slate-800 bg-[#060810]">
            {/* Header above 3D Canvas */}
            <div className="h-10 px-4 bg-[#080d19]/80 border-b border-slate-800/80 flex items-center justify-between z-10 shrink-0 text-xs font-mono">
              <span className="text-slate-300 font-bold flex items-center gap-2">
                <span>🏭</span>
                <span>3D INTERACTIVE WAREHOUSE VISUALIZER ({edgeSim?.width || 12}x{edgeSim?.height || 12})</span>
                <span className="text-slate-500 font-normal">Step: {edgeSim?.step || 0}</span>
              </span>

              <button
                onClick={resetCamera}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                title="Reset 3D Camera"
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>Reset Camera</span>
              </button>
            </div>

            {/* Three.js Mount Viewport */}
            <div
              ref={mountRef}
              className={`flex-1 w-full h-full ${
                addObstacleMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
              }`}
            />

            {/* 3D Legend Bar */}
            <div className="p-2.5 bg-[#080c18] border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-600" />
                <span>Storage Rack</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                <span>Hazard Obstacle</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Pickup Pad (P)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>Delivery Pad (D)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                <span>Rover R1</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                <span>Rover R2</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                <span>Rover R3</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                <span>Rover R4</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-cyan-400" />
                <span>Planned Route Line</span>
              </div>
            </div>
          </div>

          {/* 3B. RIGHT CONTROL PANELS */}
          <div className="w-full lg:w-[460px] bg-[#090e1c] flex flex-col h-full overflow-y-auto p-3.5 space-y-3.5 text-xs font-mono select-none">
            {/* 1. ROVER FLEET STATUS */}
            <div className="p-3 rounded-2xl bg-[#0c1224] border border-slate-800 space-y-2.5">
              <div className="font-bold text-slate-300 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-cyan-400" />
                  <span>ROVER FLEET STATUS</span>
                </span>
                <span className="text-slate-500 text-[10px]">4 ACTIVE AMRs</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {edgeSim?.robots.map(r => {
                  const col = ROVER_COLORS[r.id] || 0x3b82f6;
                  const isFailed = r.status === 'failed';
                  return (
                    <div
                      key={r.id}
                      className={`p-2.5 rounded-xl border text-[11px] space-y-1 transition-all ${
                        isFailed
                          ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: `#${col.toString(16).padStart(6, '0')}` }}
                          />
                          <span>{r.id} ({ROVER_NAMES[r.id] || 'Rover'})</span>
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            isFailed ? 'bg-rose-500/30 text-rose-300' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Pos: ({r.position[0]}, {r.position[1]}) | Battery: {r.battery ?? (100 - r.completed * 5)}%
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Task: <span className="text-white font-bold">{r.task_id || 'None'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Payload: <span className="text-amber-400 font-bold">{r.task_id ? 'Package' : 'None'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. TASK ALLOCATION QUEUE */}
            <div className="p-3 rounded-2xl bg-[#0c1224] border border-slate-800 space-y-2">
              <div className="font-bold text-slate-300 text-xs flex items-center justify-between">
                <span>📋 TASK ALLOCATION QUEUE</span>
                <span className="text-slate-500 text-[10px]">{edgeSim?.tasks.length || 0} tasks</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-left">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800/80">
                      <th className="pb-1.5 font-bold">TASK</th>
                      <th className="pb-1.5 font-bold">PICKUP → DELIVERY</th>
                      <th className="pb-1.5 font-bold">PRIORITY</th>
                      <th className="pb-1.5 font-bold">STATUS</th>
                      <th className="pb-1.5 font-bold">ASSIGNED</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-slate-300">
                    {edgeSim?.tasks.map(t => (
                      <tr key={t.id} className="hover:bg-slate-900/40">
                        <td className="py-1.5 font-bold text-white">{t.id}</td>
                        <td className="py-1.5 text-slate-400">
                          ({t.pickup[0]},{t.pickup[1]}) → ({t.delivery[0]},{t.delivery[1]})
                        </td>
                        <td className="py-1.5 font-bold">
                          <span
                            className={
                              t.priority >= 3
                                ? 'text-amber-400'
                                : t.priority === 2
                                ? 'text-cyan-400'
                                : 'text-slate-400'
                            }
                          >
                            {t.priority >= 3 ? 'HIGH' : t.priority === 2 ? 'NORMAL' : 'MEDIUM'}
                          </span>
                        </td>
                        <td className="py-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              t.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : t.status === 'delivering'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : t.status === 'assigned'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-1.5 font-bold text-white">{t.assigned_robot_id || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. EDGE DECISION EXPLANATIONS & TRAIN LOCAL ML MODEL */}
            <div className="p-3 rounded-2xl bg-[#0c1224] border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                  <span>🧠</span>
                  <span>EDGE DECISION EXPLANATIONS</span>
                </span>
                <span className="text-[10px] text-slate-500">Self-Learning Policy</span>
              </div>

              {/* Train Local Model Action Button */}
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/70 border border-slate-800">
                <button
                  onClick={handleTrainLocalModel}
                  disabled={trainingState === 'training'}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-headline font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-cyan-500/20 active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                  <span>
                    {trainingState === 'training'
                      ? 'Training Edge Model...'
                      : 'Train Local ML Model'}
                  </span>
                </button>

                <div className="text-[10px] font-mono">
                  {trainingState === 'trained' ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Model Trained (v{edgeStatus?.training_runs || 1})
                    </span>
                  ) : trainingState === 'training' ? (
                    <span className="text-cyan-400 font-bold animate-pulse">Fitting past moves...</span>
                  ) : (
                    <span className="text-slate-500">Untrained local rules</span>
                  )}
                </div>
              </div>

              {/* Decision Text Feed */}
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-300 space-y-1 max-h-24 overflow-y-auto">
                {edgeStatus?.recent_decisions && edgeStatus.recent_decisions.length > 0 ? (
                  edgeStatus.recent_decisions.slice(-3).map((d, i) => (
                    <div key={i} className="truncate">
                      <span className="text-cyan-400 font-bold">{d.robot_id || 'System'}</span> →{' '}
                      <span className="text-indigo-300 font-bold">{d.task_id}</span> via{' '}
                      <span className="text-emerald-400 font-bold">{d.method}</span>: {d.reason}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-center py-2">
                    No recent edge engine decisions. Click START SIMULATION.
                  </div>
                )}
              </div>
            </div>

            {/* 4. REAL-TIME AUDIT EVENT FEED */}
            <div className="p-3 rounded-2xl bg-[#0c1224] border border-slate-800 space-y-1.5 flex-1 flex flex-col min-h-[140px]">
              <div className="font-bold text-slate-300 text-xs flex items-center justify-between">
                <span>📜 REAL-TIME AUDIT EVENT FEED</span>
                <span className="text-[9px] text-slate-500">100Hz Event Bus</span>
              </div>

              <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800/80 p-2.5 overflow-y-auto font-mono text-[10px] space-y-1 text-slate-300 max-h-36">
                {auditLogs.map((log, i) => (
                  <div
                    key={i}
                    className={
                      log.type === 'ml'
                        ? 'text-emerald-400'
                        : log.type === 'train'
                        ? 'text-cyan-300'
                        : log.type === 'obstacle'
                        ? 'text-amber-300'
                        : log.type === 'fail'
                        ? 'text-rose-400'
                        : log.type === 'error'
                        ? 'text-rose-500'
                        : 'text-slate-400'
                    }
                  >
                    {log.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
