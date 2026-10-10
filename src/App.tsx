import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { LeftSidebar } from './components/LeftSidebar';
import { WarehouseCanvas } from './components/WarehouseCanvas';
import { Sidebar } from './components/Sidebar';
import { OrderModal } from './components/OrderModal';
import { MapConfigModal } from './components/MapConfigModal';
import { EmergencyCorridorModal } from './components/EmergencyCorridorModal';
import { Warehouse3DModal } from './components/Warehouse3DModal';
import { LandingPage } from './components/LandingPage';
import { TelemetryPage } from './components/TelemetryPage';
import { AnalyticsPage } from './components/AnalyticsPage';
import { SimulationState } from './types/fleet';
import { createDefaultSimulationState, stepClientSimulation } from './sim/clientSimulation';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'landing' | 'map' | 'telemetry' | 'analytics'>('landing');
  // Initialize with rich simulation state so it never starts empty
  const [simState, setSimState] = useState<SimulationState>(createDefaultSimulationState());
  const [connected, setConnected] = useState<boolean>(false);

  const [heatOn, setHeatOn] = useState<boolean>(false);
  const [routeOn, setRouteOn] = useState<boolean>(true);
  const [blockMode, setBlockMode] = useState<boolean>(false);

  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState<boolean>(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState<boolean>(false);
  const [isEdgeModalOpen, setIsEdgeModalOpen] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect WebSocket
  const connectWS = useCallback(() => {
    // If user configured remote WS via env
    const customWsUrl = import.meta.env.VITE_WS_URL;
    let wsUrl: string;

    if (customWsUrl) {
      wsUrl = customWsUrl;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      // In local dev, Vite proxies /ws to localhost:5000
      wsUrl = `${protocol}//${host}/ws`;
    }

    try {
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setConnected(true);
      };

      socket.onmessage = event => {
        try {
          const data: SimulationState = JSON.parse(event.data);
          setSimState(prev => ({
            ...data,
            grid: data.grid || prev.grid,
          }));
        } catch (err) {
          console.error('Failed to parse WebSocket state:', err);
        }
      };

      socket.onclose = () => {
        setConnected(false);
        // Exponential/gentle reconnect attempts
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connectWS, 4000);
      };

      socket.onerror = () => {
        socket.close();
      };

      wsRef.current = socket;
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    connectWS();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connectWS]);

  // Client-side simulation runner (active when disconnected & sim is running)
  useEffect(() => {
    if (connected) return; // Server handles ticks when connected

    let timer: NodeJS.Timeout;
    if (simState.running) {
      timer = setInterval(() => {
        setSimState(prev => stepClientSimulation(prev));
      }, 750);
    }
    return () => clearInterval(timer);
  }, [connected, simState.running]);

  // REST API Helpers
  const apiCall = async (url: string, method = 'POST', body: any = null) => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    try {
      const res = await fetch(`${apiBase}${url}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : null,
      });
      return await res.json();
    } catch (err) {
      // In standalone client demo mode, graceful fallback
      return null;
    }
  };

  // Handlers
  const handleToggleStart = () => {
    if (connected) {
      if (simState.running) {
        apiCall('/api/control/pause');
      } else {
        apiCall('/api/control/start');
      }
    } else {
      setSimState(prev => ({ ...prev, running: !prev.running }));
    }
  };

  const handleStep = () => {
    if (connected) {
      apiCall('/api/control/step');
    } else {
      setSimState(prev => stepClientSimulation(prev));
    }
  };

  const handleReset = () => {
    if (connected) {
      apiCall('/api/control/reset');
    } else {
      setSimState(createDefaultSimulationState());
    }
  };

  const handleBlockCell = (x: number, y: number) => {
    if (connected) {
      apiCall('/api/event/block', 'POST', { x, y });
    } else {
      setSimState(prev => {
        if (!prev.grid) return prev;
        const newCells = prev.grid.cells.map((row, ry) =>
          row.map((val, rx) => (rx === x && ry === y ? (val === 1 ? 0 : 1) : val))
        );
        return {
          ...prev,
          grid: { ...prev.grid, cells: newCells },
          events: [
            `[${new Date().toLocaleTimeString()}] Obstacle toggled at (${x}, ${y})`,
            ...prev.events.slice(0, 30),
          ],
        };
      });
    }
  };

  const handleFailRobot = (rid: number) => {
    if (connected) {
      apiCall(`/api/event/fail/${rid}`, 'POST');
    } else {
      setSimState(prev => {
        const robots = prev.robots.map(r =>
          r.id === rid ? { ...r, state: r.state === 'failed' ? 'idle' : 'failed' } : r
        );
        return {
          ...prev,
          robots,
          hive_mind: [
            { type: 'fail', msg: `Robot #${rid} manual fault toggled.` },
            ...prev.hive_mind,
          ],
        };
      });
    }
  };

  const handleSetStationPriority = (sid: number, priority: number) => {
    if (connected) {
      apiCall(`/api/station/${sid}/priority`, 'POST', { priority });
    } else {
      setSimState(prev => ({
        ...prev,
        stations: prev.stations.map(s => (s.id === sid ? { ...s, priority } : s)),
      }));
    }
  };

  const handleDispatchOrder = (priority: number, qty: number) => {
    if (connected) {
      apiCall('/api/event/order', 'POST', { priority, qty });
    } else {
      setSimState(prev => ({
        ...prev,
        total_pick_stock: (prev.total_pick_stock ?? 150) + qty,
        hive_mind: [
          { type: 'restock', msg: `Order Dispatched: ${qty} units allocated (Priority ${priority})` },
          ...prev.hive_mind,
        ],
      }));
    }
  };

  const handleDownloadMap = async (mapName: string) => {
    return await apiCall(`/api/map/download/${mapName}`, 'POST');
  };

  const handleSwitchMap = async (mapName: string, numRobots: number, capacity: number) => {
    return await apiCall('/api/map/switch', 'POST', {
      map_name: mapName,
      num_robots: numRobots,
      robot_capacity: capacity,
    });
  };

  const handleClearBlocks = () => {
    if (connected) {
      apiCall('/api/event/clear-blocks');
    } else {
      setSimState(createDefaultSimulationState());
    }
  };

  const handleRefillStation = (sid: number, qty: number, priority?: number) => {
    if (connected) {
      apiCall(`/api/station/${sid}/refill`, 'POST', { qty, priority });
    } else {
      setSimState(prev => ({
        ...prev,
        stations: prev.stations.map(s =>
          s.id === sid ? { ...s, current: Math.min(s.max, s.current + qty), priority: priority ?? s.priority } : s
        ),
      }));
    }
  };

  const handleActivateEmergency = async (
    robotId: number,
    pickupX: number,
    pickupY: number,
    dropoffX: number,
    dropoffY: number
  ) => {
    if (connected) {
      return await apiCall('/api/emergency/activate', 'POST', {
        robotId,
        pickupX,
        pickupY,
        dropoffX,
        dropoffY,
      });
    } else {
      setSimState(prev => {
        const route: [number, number][] = [
          [pickupX, pickupY],
          [Math.floor((pickupX + dropoffX) / 2), pickupY],
          [Math.floor((pickupX + dropoffX) / 2), dropoffY],
          [dropoffX, dropoffY],
        ];
        return {
          ...prev,
          emergency: {
            active: true,
            status: 'active',
            robotId,
            destination: [dropoffX, dropoffY],
            pickup: [pickupX, pickupY],
            dropoff: [dropoffX, dropoffY],
            route,
            reservedCells: route,
            intersections: [],
            yieldingRobots: prev.robots.filter(r => r.id !== robotId).map(r => r.id),
            reroutedRobots: [],
            message: `Emergency Corridor activated for Robot #${robotId}`,
          },
          hive_mind: [
            { type: 'emergency', msg: `VIP EMERGENCY CORRIDOR ACTIVE: Robot #${robotId} prioritized!` },
            ...prev.hive_mind,
          ],
        };
      });
      return { ok: true };
    }
  };

  const handleCancelEmergency = async () => {
    if (connected) {
      return await apiCall('/api/emergency/cancel', 'POST');
    } else {
      setSimState(prev => ({
        ...prev,
        emergency: {
          active: false,
          status: 'inactive',
          robotId: null,
          destination: null,
          route: [],
          reservedCells: [],
          intersections: [],
          yieldingRobots: [],
          reroutedRobots: [],
        },
      }));
      return { ok: true };
    }
  };

  const handleSelectBenchmarkFromLanding = async (mapName: string) => {
    try {
      await handleSwitchMap(mapName, 8, 1);
    } catch (err) {
      console.error(err);
    }
    setActiveView('map');
  };

  const handleNavigateArchitecture = () => {
    setActiveView('landing');
    setTimeout(() => {
      const el = document.getElementById('architecture');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  if (activeView === 'landing') {
    return (
      <LandingPage
        onLaunchSimulator={() => setActiveView('map')}
        onSelectBenchmarkMap={handleSelectBenchmarkFromLanding}
      />
    );
  }

  if (activeView === 'telemetry') {
    return (
      <TelemetryPage
        state={simState}
        onBackToMap={() => setActiveView('map')}
        onFailRobot={handleFailRobot}
      />
    );
  }

  if (activeView === 'analytics') {
    return (
      <AnalyticsPage
        state={simState}
        onBackToMap={() => setActiveView('map')}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07090e] text-slate-100 overflow-hidden">
      {/* Top Navbar: Primary Simulation CTAs & High Priority Actions */}
      <Navbar
        state={simState}
        connected={connected}
        onToggleStart={handleToggleStart}
        onStep={handleStep}
        onReset={handleReset}
        onOpenOrderModal={() => setIsOrderModalOpen(true)}
        onOpenMapModal={() => setIsMapModalOpen(true)}
        onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
      />

      {/* Main Workspace Area with Balanced Tri-Panel Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Tool Panel: Views, Map Layers, Legend & Fleet Quick Status */}
        <LeftSidebar
          state={simState}
          heatOn={heatOn}
          routeOn={routeOn}
          blockMode={blockMode}
          onToggleHeat={() => setHeatOn(h => !h)}
          onToggleRoutes={() => setRouteOn(r => !r)}
          onToggleBlock={() => setBlockMode(b => !b)}
          onClearBlocks={handleClearBlocks}
          onNavigateHome={() => setActiveView('landing')}
          onNavigateArchitecture={handleNavigateArchitecture}
          onNavigateTelemetry={() => setActiveView('telemetry')}
          onNavigateAnalytics={() => setActiveView('analytics')}
          onOpenEdgeAIModal={() => setIsEdgeModalOpen(true)}
        />

        {/* Center: Interactive Warehouse Simulation Canvas */}
        <WarehouseCanvas
          state={simState}
          heatOn={heatOn}
          routeOn={routeOn}
          blockMode={blockMode}
          onBlockCell={handleBlockCell}
          onFailRobot={handleFailRobot}
          onClearBlocks={handleClearBlocks}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
          onCancelEmergency={handleCancelEmergency}
        />

        {/* Right Dashboard Sidebar: Task Assignments, Stations, Conflicts, Hive Mind & Performance */}
        <Sidebar
          state={simState}
          onSetStationPriority={handleSetStationPriority}
          onFailRobot={handleFailRobot}
          onRefillStation={handleRefillStation}
        />
      </div>

      {/* Order Modal */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onDispatch={handleDispatchOrder}
        robotCapacity={1}
      />

      {/* Map & Swarm Configuration Modal */}
      <MapConfigModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        onSwitchMap={handleSwitchMap}
        onDownloadMap={handleDownloadMap}
      />

      {/* Emergency Corridor Modal */}
      <EmergencyCorridorModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        state={simState}
        onActivate={handleActivateEmergency}
        onCancel={handleCancelEmergency}
      />

      {/* AURA EdgeAI 3D Warehouse Digital Twin Modal */}
      <Warehouse3DModal
        isOpen={isEdgeModalOpen}
        onClose={() => setIsEdgeModalOpen(false)}
        state={simState}
      />
    </div>
  );
};
