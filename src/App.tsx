import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { WarehouseCanvas } from './components/WarehouseCanvas';
import { Sidebar } from './components/Sidebar';
import { OrderModal } from './components/OrderModal';
import { MapConfigModal } from './components/MapConfigModal';
import { EmergencyCorridorModal } from './components/EmergencyCorridorModal';
import { LandingPage } from './components/LandingPage';
import { TelemetryPage } from './components/TelemetryPage';
import { AnalyticsPage } from './components/AnalyticsPage';
import { SimulationState } from './types/fleet';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'landing' | 'map' | 'telemetry' | 'analytics'>('landing');
  const [simState, setSimState] = useState<SimulationState | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  const [heatOn, setHeatOn] = useState<boolean>(false);
  const [routeOn, setRouteOn] = useState<boolean>(true);
  const [blockMode, setBlockMode] = useState<boolean>(false);

  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState<boolean>(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Connect WebSocket
  const connectWS = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setConnected(true);
    };

    socket.onmessage = event => {
      try {
        const data: SimulationState = JSON.parse(event.data);
        setSimState(prev => ({
          ...data,
          grid: data.grid || prev?.grid,
        }));
      } catch (err) {
        console.error('Failed to parse WebSocket state:', err);
      }
    };

    socket.onclose = () => {
      setConnected(false);
      setTimeout(connectWS, 1500);
    };

    socket.onerror = err => {
      console.error('WebSocket error:', err);
      socket.close();
    };

    wsRef.current = socket;
  }, []);

  useEffect(() => {
    connectWS();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWS]);

  // REST API Helpers
  const apiCall = async (url: string, method = 'POST', body: any = null) => {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : null,
      });
      return await res.json();
    } catch (err) {
      console.error(`API Call ${url} failed:`, err);
      throw err;
    }
  };

  // Handlers
  const handleToggleStart = () => {
    if (simState?.running) {
      apiCall('/api/control/pause');
    } else {
      apiCall('/api/control/start');
    }
  };

  const handleStep = () => {
    apiCall('/api/control/step');
  };

  const handleReset = () => {
    apiCall('/api/control/reset');
  };

  const handleBlockCell = (x: number, y: number) => {
    apiCall('/api/event/block', 'POST', { x, y });
  };

  const handleFailRobot = (rid: number) => {
    apiCall(`/api/event/fail/${rid}`, 'POST');
  };

  const handleSetStationPriority = (sid: number, priority: number) => {
    apiCall(`/api/station/${sid}/priority`, 'POST', { priority });
  };

  const handleDispatchOrder = (priority: number, qty: number) => {
    apiCall('/api/event/order', 'POST', { priority, qty });
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
    apiCall('/api/event/clear-blocks');
  };

  const handleRefillStation = (sid: number, qty: number, priority?: number) => {
    apiCall(`/api/station/${sid}/refill`, 'POST', { qty, priority });
  };

  const handleActivateEmergency = async (robotId: number, targetX: number, targetY: number) => {
    return await apiCall('/api/emergency/activate', 'POST', { robotId, targetX, targetY });
  };

  const handleCancelEmergency = async () => {
    return await apiCall('/api/emergency/cancel', 'POST');
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
      {/* Top Navbar */}
      <Navbar
        state={simState}
        connected={connected}
        heatOn={heatOn}
        routeOn={routeOn}
        blockMode={blockMode}
        onToggleStart={handleToggleStart}
        onStep={handleStep}
        onReset={handleReset}
        onToggleHeat={() => setHeatOn(h => !h)}
        onToggleRoutes={() => setRouteOn(r => !r)}
        onToggleBlock={() => setBlockMode(b => !b)}
        onClearBlocks={handleClearBlocks}
        onOpenOrderModal={() => setIsOrderModalOpen(true)}
        onOpenMapModal={() => setIsMapModalOpen(true)}
        onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
        onNavigateHome={() => setActiveView('landing')}
        onNavigateArchitecture={handleNavigateArchitecture}
        onNavigateTelemetry={() => setActiveView('telemetry')}
        onNavigateAnalytics={() => setActiveView('analytics')}
      />

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Interactive Warehouse Canvas */}
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

        {/* Right Dashboard Sidebar */}
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
    </div>
  );
};
