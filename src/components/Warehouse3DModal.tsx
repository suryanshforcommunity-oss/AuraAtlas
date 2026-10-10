import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimulationState } from '../types/fleet';
import {
  X,
  Maximize2,
  Camera,
  RotateCcw,
  Zap,
  Activity,
  Cpu,
  Eye,
  Layers,
  Compass,
  Boxes,
  ShieldCheck,
  Radio,
  Wifi,
  WifiOff
} from 'lucide-react';

interface Warehouse3DModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: SimulationState | null;
}

interface EdgeStatus {
  ok?: boolean;
  connected: boolean;
  mode?: string;
  model_loaded?: boolean;
  fallback_active?: boolean;
  cloud_required?: boolean;
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
}

export const Warehouse3DModal: React.FC<Warehouse3DModalProps> = ({
  isOpen,
  onClose,
  state
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraMode, setCameraMode] = useState<'orbit' | 'top' | 'follow'>('orbit');
  const [selectedRobotId, setSelectedRobotId] = useState<number>(0);
  const [edgeStatus, setEdgeStatus] = useState<EdgeStatus | null>(null);
  const [offlineSim, setOfflineSim] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastActionMsg, setLastActionMsg] = useState<string | null>(null);

  // References to keep Three.js scene alive across state updates
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const robotMeshesRef = useRef<Map<number, THREE.Group>>(new Map());
  const corridorMeshesRef = useRef<THREE.Mesh[]>([]);

  // Fetch Edge AI status
  const fetchEdgeStatus = async () => {
    try {
      const res = await fetch('/api/edge/status');
      const data = await res.json();
      setEdgeStatus(data);
    } catch {
      setEdgeStatus({ connected: false });
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEdgeStatus();
      const interval = setInterval(fetchEdgeStatus, 2500);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleEdgeStep = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/edge/step', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setLastActionMsg(`Edge AI computed assignments in ${data.edge?.last_latency_ms || 0.5}ms`);
        fetchEdgeStatus();
      }
    } catch (err: any) {
      setLastActionMsg(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOffline = async () => {
    const next = !offlineSim;
    setLoading(true);
    try {
      const res = await fetch(`/api/edge/offline/${next}`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setOfflineSim(next);
        fetchEdgeStatus();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize Three.js 3D Scene
  useEffect(() => {
    if (!isOpen || !mountRef.current || !state?.grid) return;

    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    const grid = state.grid;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    scene.fog = new THREE.FogExp2(0x06080e, 0.015);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const centerX = grid.width / 2;
    const centerZ = grid.height / 2;
    camera.position.set(centerX, Math.max(grid.width, grid.height) * 0.9, centerZ + Math.max(grid.width, grid.height) * 0.8);
    camera.lookAt(centerX, 0, centerZ);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(centerX, 0, centerZ);
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera going below floor
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
    dirLight.position.set(centerX - 10, 30, centerZ - 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -grid.width;
    dirLight.shadow.camera.right = grid.width;
    dirLight.shadow.camera.top = grid.height;
    dirLight.shadow.camera.bottom = -grid.height;
    scene.add(dirLight);

    const bluePointLight = new THREE.PointLight(0x06b6d4, 1.5, 40);
    bluePointLight.position.set(centerX, 8, centerZ);
    scene.add(bluePointLight);

    // 6. Floor & Grid Texture
    const floorGeo = new THREE.PlaneGeometry(grid.width, grid.height);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centerX, -0.01, centerZ);
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor Grid Lines
    const gridHelper = new THREE.GridHelper(Math.max(grid.width, grid.height) * 1.5, Math.max(grid.width, grid.height) * 3, 0x1e293b, 0x0f172a);
    gridHelper.position.set(centerX, 0.01, centerZ);
    scene.add(gridHelper);

    // 7. Warehouse Rack Pods (3D Storage Shelves)
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.5 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.3 });
    const rackFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3, metalness: 0.8 });

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.cells[y][x] === 1) {
          const rackGroup = new THREE.Group();
          rackGroup.position.set(x + 0.5, 0, y + 0.5);

          // Rack Pod Base Block
          const podGeo = new THREE.BoxGeometry(0.88, 1.4, 0.88);
          const podMesh = new THREE.Mesh(podGeo, rackMat);
          podMesh.position.y = 0.7;
          podMesh.castShadow = true;
          podMesh.receiveShadow = true;
          rackGroup.add(podMesh);

          // Top Shelf Frame
          const frameGeo = new THREE.BoxGeometry(0.92, 0.06, 0.92);
          const frameMesh = new THREE.Mesh(frameGeo, rackFrameMat);
          frameMesh.position.y = 1.42;
          rackGroup.add(frameMesh);

          // Storage Crates / Goods on Top of Rack
          const crateGeo = new THREE.BoxGeometry(0.72, 0.45, 0.72);
          const crateMesh = new THREE.Mesh(crateGeo, crateMat);
          crateMesh.position.y = 1.68;
          crateMesh.castShadow = true;
          rackGroup.add(crateMesh);

          scene.add(rackGroup);
        }
      }
    }

    // 8. Stations in 3D: Pick (Emerald), Drop (Orange), Charging (Cyan)
    (grid.pick_stations || []).forEach(([px, py]) => {
      const pickGroup = new THREE.Group();
      pickGroup.position.set(px + 0.5, 0.02, py + 0.5);

      const padGeo = new THREE.BoxGeometry(0.9, 0.05, 0.9);
      const padMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x047857, emissiveIntensity: 0.6 });
      const pad = new THREE.Mesh(padGeo, padMat);
      pickGroup.add(pad);

      // Emerald beacon pillar
      const beamGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 12);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.4 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 1.25;
      pickGroup.add(beam);

      scene.add(pickGroup);
    });

    (grid.drop_stations || []).forEach(([dx, dy]) => {
      const dropGroup = new THREE.Group();
      dropGroup.position.set(dx + 0.5, 0.02, dy + 0.5);

      const padGeo = new THREE.BoxGeometry(0.9, 0.05, 0.9);
      const padMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xc2410c, emissiveIntensity: 0.6 });
      const pad = new THREE.Mesh(padGeo, padMat);
      dropGroup.add(pad);

      // Orange beacon pillar
      const beamGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 12);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.4 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 1.25;
      dropGroup.add(beam);

      scene.add(dropGroup);
    });

    (grid.charging_stations || []).forEach(([cx, cy]) => {
      const padGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16);
      const padMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.7 });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(cx + 0.5, 0.03, cy + 0.5);
      scene.add(pad);
    });

    // 9. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Follow camera logic
      if (cameraMode === 'follow' && robotMeshesRef.current.has(selectedRobotId)) {
        const targetMesh = robotMeshesRef.current.get(selectedRobotId);
        if (targetMesh && controlsRef.current) {
          const tPos = targetMesh.position;
          controlsRef.current.target.lerp(new THREE.Vector3(tPos.x, 0.3, tPos.z), 0.1);
        }
      }

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

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

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      robotMeshesRef.current.clear();
    };
  }, [isOpen, state?.grid]);

  // Update Dynamic Robots, Cargo & Emergency Corridor in 3D Scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !state?.robots) return;

    const robots = state.robots;
    const robotMap = robotMeshesRef.current;
    const emergency = state.emergency;

    // A. Update or create 3D Robot Meshes
    robots.forEach(r => {
      let group = robotMap.get(r.id);

      if (!group) {
        group = new THREE.Group();

        // 1. AGV Main Chassis
        const chassisGeo = new THREE.CylinderGeometry(0.36, 0.38, 0.18, 24);
        const chassisMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(r.color || '#6366f1'),
          roughness: 0.3,
          metalness: 0.6
        });
        const chassis = new THREE.Mesh(chassisGeo, chassisMat);
        chassis.position.y = 0.09;
        chassis.castShadow = true;
        group.add(chassis);

        // 2. LED Status Ring / Halo
        const ringGeo = new THREE.TorusGeometry(0.39, 0.03, 8, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(r.color || '#6366f1') });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.12;
        group.add(ring);

        // 3. Direction Pointer Arrow Head
        const pointerGeo = new THREE.ConeGeometry(0.1, 0.22, 12);
        pointerGeo.rotateX(Math.PI / 2);
        const pointerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pointer = new THREE.Mesh(pointerGeo, pointerMat);
        pointer.position.set(0, 0.19, -0.22);
        group.add(pointer);

        // 4. Carried Payload Box (visible when carrying > 0)
        const boxGeo = new THREE.BoxGeometry(0.38, 0.28, 0.38);
        const boxMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          roughness: 0.3,
          metalness: 0.2
        });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.name = 'payload';
        box.position.y = 0.32;
        box.castShadow = true;
        box.visible = r.carrying > 0;
        group.add(box);

        // 5. Emergency Siren Beam / Glow
        const sirenGeo = new THREE.SphereGeometry(0.12, 12, 12);
        const sirenMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const siren = new THREE.Mesh(sirenGeo, sirenMat);
        siren.name = 'siren';
        siren.position.y = 0.35;
        siren.visible = false;
        group.add(siren);

        scene.add(group);
        robotMap.set(r.id, group);
      }

      // Smooth Position Interpolation in 3D
      const targetX = r.x + 0.5;
      const targetZ = r.y + 0.5;
      group.position.x = THREE.MathUtils.lerp(group.position.x, targetX, 0.3);
      group.position.z = THREE.MathUtils.lerp(group.position.z, targetZ, 0.3);

      // Rotation towards next path coordinate
      if (r.path && r.path.length > 1) {
        const next = r.path[1];
        const angle = Math.atan2(next[0] - r.x, next[1] - r.y);
        group.rotation.y = angle + Math.PI;
      }

      // Payload Visibility
      const payloadMesh = group.getObjectByName('payload');
      if (payloadMesh) {
        payloadMesh.visible = r.carrying > 0;
      }

      // Emergency Siren Status
      const isEmerg = r.isEmergency || (emergency?.active && emergency.robotId === r.id);
      const sirenMesh = group.getObjectByName('siren');
      if (sirenMesh) {
        sirenMesh.visible = !!isEmerg;
      }
    });

    // B. Emergency Corridor Reservation 3D Highlights
    // Clear old corridor highlight tiles
    corridorMeshesRef.current.forEach(m => scene.remove(m));
    corridorMeshesRef.current = [];

    if (emergency && emergency.active && emergency.reservedCells) {
      const tileGeo = new THREE.PlaneGeometry(0.96, 0.96);
      const tileMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
      });

      emergency.reservedCells.forEach(([cx, cy]) => {
        const tile = new THREE.Mesh(tileGeo, tileMat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(cx + 0.5, 0.04, cy + 0.5);
        scene.add(tile);
        corridorMeshesRef.current.push(tile);
      });
    }
  }, [state?.robots, state?.emergency]);

  // Camera presets
  const handleSetCamera = (mode: 'orbit' | 'top' | 'follow') => {
    setCameraMode(mode);
    if (!controlsRef.current || !cameraRef.current || !state?.grid) return;

    const grid = state.grid;
    const centerX = grid.width / 2;
    const centerZ = grid.height / 2;

    if (mode === 'top') {
      cameraRef.current.position.set(centerX, Math.max(grid.width, grid.height) * 1.2, centerZ + 0.01);
      controlsRef.current.target.set(centerX, 0, centerZ);
    } else if (mode === 'orbit') {
      cameraRef.current.position.set(centerX, Math.max(grid.width, grid.height) * 0.9, centerZ + Math.max(grid.width, grid.height) * 0.8);
      controlsRef.current.target.set(centerX, 0, centerZ);
    }
  };

  if (!isOpen) return null;

  const isConnected = edgeStatus?.connected ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md select-none animate-fadeIn">
      <div className="w-full h-full max-w-7xl max-h-[92vh] rounded-2xl bg-[#080c16] border border-cyan-500/40 shadow-2xl shadow-cyan-950/80 relative flex flex-col overflow-hidden reticle-box">
        {/* Top Header Bar */}
        <div className="h-16 px-6 bg-[#0a0f1d]/90 border-b border-slate-800/90 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Boxes className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-headline font-bold text-white tracking-wide">
                  AURA EdgeAI — Interactive 3D Warehouse Digital Twin
                </h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    isConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
                  {isConnected ? 'EDGE AI CONNECTED' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Hardware-accelerated 3D spatial simulation with sub-millisecond local rule decision engine
              </p>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-3">
            {/* Camera View Switcher */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              <button
                onClick={() => handleSetCamera('orbit')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  cameraMode === 'orbit' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="Free 3D Orbit View"
              >
                Orbit 3D
              </button>
              <button
                onClick={() => handleSetCamera('top')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  cameraMode === 'top' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="Overhead 2.5D Top-Down View"
              >
                Top-Down
              </button>
              <button
                onClick={() => handleSetCamera('follow')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  cameraMode === 'follow' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
                title="Follow Selected Robot"
              >
                Follow AGV
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors"
              title="Close 3D View"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3D Viewport Area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Three.js Mount Container */}
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Floating Live Telemetry HUD Overlay (Top-Left) */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-sm pointer-events-none select-none">
            {/* Live Edge Engine Metrics */}
            <div className="p-3 rounded-2xl bg-[#0b101d]/90 border border-slate-800/90 shadow-2xl backdrop-blur-md text-xs font-mono space-y-1.5 pointer-events-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  Edge AI Decision Engine
                </span>
                <span className="text-emerald-400 font-bold text-[10px]">
                  {edgeStatus?.last_latency_ms ?? 0.53} ms
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                <div>
                  <span className="text-slate-500 block text-[9px]">ENGINE MODE</span>
                  <span className="font-bold text-white truncate block">
                    {edgeStatus?.mode || 'RULE_FALLBACK'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px]">CLOUD DEPENDENCY</span>
                  <span className="font-bold text-cyan-300">Zero (Local Edge)</span>
                </div>
              </div>

              {edgeStatus?.recent_decisions && edgeStatus.recent_decisions.length > 0 && (
                <div className="pt-1.5 border-t border-slate-800/80">
                  <span className="text-slate-500 block text-[9px] mb-1">LATEST LOCAL DECISION</span>
                  <div className="text-[10px] text-slate-300 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800 truncate">
                    <span className="text-cyan-400 font-bold">
                      {edgeStatus.recent_decisions[edgeStatus.recent_decisions.length - 1].robot_id || 'R1'}
                    </span>
                    : {edgeStatus.recent_decisions[edgeStatus.recent_decisions.length - 1].reason}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={handleEdgeStep}
                disabled={loading || !isConnected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 text-xs font-headline font-bold uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-40"
              >
                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                <span>Trigger Edge Step</span>
              </button>

              <button
                onClick={handleToggleOffline}
                disabled={loading || !isConnected}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all backdrop-blur ${
                  offlineSim
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                {offlineSim ? <WifiOff className="w-3.5 h-3.5 text-amber-400" /> : <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{offlineSim ? 'Offline Active' : 'Simulate Outage'}</span>
              </button>
            </div>

            {lastActionMsg && (
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono backdrop-blur pointer-events-auto">
                {lastActionMsg}
              </div>
            )}
          </div>

          {/* 3D Legend & Controls Hint (Bottom-Right) */}
          <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-none">
            <div className="p-3 rounded-2xl bg-[#0b101d]/90 border border-slate-800/90 shadow-2xl backdrop-blur-md text-[11px] font-mono space-y-1.5 text-slate-300 pointer-events-auto">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
                3D Spatial Controls
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                <span>Emerald: Pick Station Pads</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-orange-500" />
                <span>Orange: Drop Off Docks</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-cyan-400" />
                <span>Cyan: Sub-floor Resonant Chargers</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-rose-500 animate-pulse" />
                <span>Red: VVIP Emergency Corridor</span>
              </div>
              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                Left Click: Rotate • Right Click: Pan • Scroll: Zoom
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
