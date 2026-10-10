import React, { useState } from 'react';
import Galaxy from './Galaxy';
import Prism from './Prism';
import {
  Zap,
  Play,
  Layers,
  ShieldCheck,
  Cpu,
  Activity,
  ArrowRight,
  TrendingUp,
  Map,
  Boxes,
  Compass,
  CheckCircle2,
  Sparkles,
  Grid as GridIcon,
  Server,
  Radio,
  Network,
  BatteryCharging,
  Sliders,
  X,
  Lock,
  Workflow,
  Globe,
  Terminal,
  ShieldAlert
} from 'lucide-react';

import LuminousType from './LuminousType';
import LogoLoop, { LogoItem } from './LogoLoop';
import {
  SiReact,
  SiTypescript,
  SiNodedotjs,
  SiVite,
  SiTailwindcss,
  SiExpress,
  SiSocketdotio,
  SiHtml5,
  SiWebgl
} from 'react-icons/si';

interface LandingPageProps {
  onLaunchSimulator: () => void;
  onSelectBenchmarkMap: (mapName: string) => void;
}

interface BenchmarkCard {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  dim: string;
  desc: string;
  icon: React.ReactNode;
}

const BENCHMARK_CARDS: BenchmarkCard[] = [
  {
    id: 'custom',
    name: 'Structured Pod Warehouse',
    badge: 'Standard AGV Pod',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    dim: '36 × 28 Grid',
    desc: '6 double-deep storage rack pods, perimeter aisles, pick stations & drop docks.',
    icon: <Layers className="w-5 h-5 text-cyan-400" />,
  },
  {
    id: 'warehouse-10-20-10-2-1',
    name: 'Warehouse 10-20 Small Pods',
    badge: 'Standard MovingAI',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    dim: '36 × 24 Grid',
    desc: 'Classic warehouse pod matrix with vertical cross-aisles and perimeter hubs.',
    icon: <Map className="w-5 h-5 text-cyan-400" />,
  },
  {
    id: 'warehouse-20-40-10-2-1',
    name: 'Warehouse 20-40 Distribution Hub',
    badge: 'Distribution Center',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    dim: '48 × 32 Large Grid',
    desc: 'Expanded distribution center with multi-bay matrices and high-frequency dispatch.',
    icon: <Boxes className="w-5 h-5 text-purple-400" />,
  },
  {
    id: 'maze-32-32-2',
    name: 'Maze Nexus 32×32',
    badge: 'High Density Maze',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    dim: '32 × 32 Maze Grid',
    desc: 'Complex corridor blockages & dead-ends designed to test PIBT yield routing.',
    icon: <Compass className="w-5 h-5 text-indigo-400" />,
  },
  {
    id: 'random-32-32-10',
    name: 'Random Scatter Obstacles',
    badge: 'Scatter Field',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    dim: '32 × 32 Scatter Grid',
    desc: '22% random obstacle density scatter field testing dynamic path rerouting.',
    icon: <Boxes className="w-5 h-5 text-amber-400" />,
  },
  {
    id: 'empty-32-32',
    name: 'Open Fleet Arena 32×32',
    badge: 'Open Arena',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    dim: '32 × 32 Open Floor',
    desc: 'Clear open grid space for maximum speed swarm velocity testing.',
    icon: <GridIcon className="w-5 h-5 text-emerald-400" />,
  },
];

const TECH_STACK_LOGOS: LogoItem[] = [
  {
    node: (
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#0e131f]/90 border border-slate-800 text-slate-200 hover:border-cyan-400/60 hover:text-cyan-300 transition-all shadow-lg backdrop-blur group">
        <SiReact className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
        <span className="font-mono text-xs font-semibold tracking-wider">React 18</span>
      </div>
    ),
    title: 'React 18',
    href: 'https://react.dev'
  },
  {
    node: (
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#0e131f]/90 border border-slate-800 text-slate-200 hover:border-blue-400/60 hover:text-blue-300 transition-all shadow-lg backdrop-blur group">
        <SiTypescript className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
        <span className="font-mono text-xs font-semibold tracking-wider">TypeScript 5</span>
      </div>
    ),
    title: 'TypeScript',
    href: 'https://www.typescriptlang.org'
  },
  {
    node: (
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#0e131f]/90 border border-slate-800 text-slate-200 hover:border-emerald-400/60 hover:text-emerald-300 transition-all shadow-lg backdrop-blur group">
        <SiNodedotjs className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
        <span className="font-mono text-xs font-semibold tracking-wider">Node.js Engine</span>
      </div>
    ),
    title: 'Node.js',
    href: 'https://nodejs.org'
  },
  {
    node: (
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#0e131f]/90 border border-slate-800 text-slate-200 hover:border-purple-400/60 hover:text-purple-300 transition-all shadow-lg backdrop-blur group">
        <SiVite className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
        <span className="font-mono text-xs font-semibold tracking-wider">Vite Bundler</span>
      </div>
    ),
    title: 'Vite',
    href: 'https://vitejs.dev'
  },
  {
    node: (
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#0e131f]/90 border border-slate-800 text-slate-200 hover:border-cyan-400/60 hover:text-cyan-300 transition-all shadow-lg backdrop-blur group">
        <SiTailwindcss className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
        <span className="font-mono text-xs font-semibold tracking-wider">Tailwind CSS</span>
      </div>
    ),
    title: 'Tailwind CSS',
    href: 'https://tailwindcss.com'
  },
  {
    node: (
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#0e131f]/90 border border-slate-800 text-slate-200 hover:border-slate-400/60 hover:text-white transition-all shadow-lg backdrop-blur group">
        <SiExpress className="w-5 h-5 text-slate-300 group-hover:scale-110 transition-transform" />
        <span className="font-mono text-xs font-semibold tracking-wider">Express REST</span>
      </div>
    ),
    title: 'Express REST API',
    href: 'https://expressjs.com'
  },
  {
    node: (
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#0e131f]/90 border border-slate-800 text-slate-200 hover:border-rose-400/60 hover:text-rose-300 transition-all shadow-lg backdrop-blur group">
        <SiSocketdotio className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />
        <span className="font-mono text-xs font-semibold tracking-wider">WebSockets Sub-MS</span>
      </div>
    ),
    title: 'WebSockets Streaming',
    href: 'https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API'
  },
  {
    node: (
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#0e131f]/90 border border-slate-800 text-slate-200 hover:border-orange-400/60 hover:text-orange-300 transition-all shadow-lg backdrop-blur group">
        <SiHtml5 className="w-5 h-5 text-orange-400 group-hover:scale-110 transition-transform" />
        <span className="font-mono text-xs font-semibold tracking-wider">Canvas 2D Simulator</span>
      </div>
    ),
    title: 'Canvas 2D Simulator',
    href: 'https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API'
  },
  {
    node: (
      <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#0e131f]/90 border border-slate-800 text-slate-200 hover:border-indigo-400/60 hover:text-indigo-300 transition-all shadow-lg backdrop-blur group">
        <SiWebgl className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
        <span className="font-mono text-xs font-semibold tracking-wider">WebGL & OGL</span>
      </div>
    ),
    title: 'WebGL / OGL Shaders',
    href: 'https://www.khronos.org/webgl/'
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchSimulator,
  onSelectBenchmarkMap,
}) => {
  const [showArchModal, setShowArchModal] = useState<boolean>(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="h-screen w-screen bg-black text-slate-100 flex flex-col font-sans overflow-y-auto overflow-x-hidden scroll-smooth selection:bg-cyan-500/30 selection:text-cyan-200 relative">
      {/* React Bits Galaxy Component Background - Pure Black Background & Monochrome White Stars */}
      <div className="fixed inset-0 pointer-events-auto z-0 overflow-hidden bg-black">
        <Galaxy
          density={0.4}
          glowIntensity={0.25}
          saturation={0.0}
          mouseRepulsion={true}
          repulsionStrength={1.5}
          starSpeed={0.3}
          transparent={false}
        />
      </div>

      {/* Top Header Navigation */}
      <header className="h-20 border-b border-slate-800 px-6 lg:px-16 flex items-center justify-between backdrop-blur-xl bg-black/80 sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-900/90 border border-cyan-500/40 p-1 flex items-center justify-center shadow-lg shadow-cyan-500/20 backdrop-blur-sm">
            <img
              src="/logo-icon.png"
              alt="FleetSync"
              className="w-full h-full object-contain filter drop-shadow-[0_0_10px_rgba(0,240,255,0.7)]"
            />
          </div>
          <div>
            <h1 className="font-bold text-lg font-headline tracking-wider text-white uppercase flex items-center gap-1.5">
              <span>FLEET</span><span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]">SYNC</span> AGV
              <span className="text-cyan-400 font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 tracking-widest ml-1">
                MESH v4.8.2 ACTIVE
              </span>
            </h1>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 text-xs font-mono text-slate-300">
          <button onClick={() => scrollToSection('features')} className="hover:text-cyan-300 transition-colors uppercase">
            Capabilities
          </button>
          <button onClick={() => scrollToSection('benchmarks')} className="hover:text-cyan-300 transition-colors uppercase">
            Spatial Maps
          </button>
          <button onClick={() => scrollToSection('architecture')} className="hover:text-cyan-300 transition-colors uppercase">
            Architecture Specs
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onLaunchSimulator}
            className="flex items-center gap-2 px-5 py-2 rounded bg-cyan-400 text-slate-950 font-headline text-xs font-bold uppercase tracking-wider hover:bg-cyan-300 transition-all shadow active:scale-95 glow-cyan"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Deploy Swarm Simulator</span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 space-y-24 relative z-10">
        {/* HERO SECTION */}
        <section className="pt-20 pb-12 px-6 lg:px-16 max-w-7xl mx-auto flex flex-col items-center text-center relative">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded bg-[#0e131f] border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-8 reticle-box shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>FLEETSYNC 4.8 // NEXT-GEN AUTONOMOUS LOGISTICS ORCHESTRATOR</span>
          </div>

          {/* Hero Main Headline with React Bits Pro Luminous Type Drifting Spotlight effect */}
          <h1 className="text-4xl sm:text-6xl font-headline font-bold text-white max-w-5xl leading-[1.1] tracking-tight min-h-[120px] sm:min-h-[140px] flex items-center justify-center">
            <LuminousType
              text="Autonomous AGV Swarm Coordination at Sub-Millisecond Precision"
              highlightText="Sub-Millisecond Precision"
              speed={1.0}
              spotlightRadius={280}
              interactive={true}
            />
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-slate-300 text-base sm:text-lg max-w-3xl leading-relaxed font-body">
            Decentralized Priority-Inheritance Backtracking (PIBT) orchestration layer with real-time continuous collision avoidance, distributed LiDAR point-cloud mapping, and dynamic inductive battery balancing across 500+ automated aisles.
          </p>

          {/* CTA Action Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={onLaunchSimulator}
              className="w-full sm:w-auto px-8 py-4 rounded bg-cyan-400 text-slate-950 font-headline text-sm font-bold tracking-wider uppercase hover:bg-cyan-300 transition-all shadow-2xl flex items-center justify-center gap-2.5 group active:scale-95 glow-cyan"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Launch Live Swarm Dashboard</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => scrollToSection('architecture')}
              className="w-full sm:w-auto px-8 py-4 rounded bg-[#0e131f] hover:bg-[#161d2f] text-slate-200 border border-slate-700 text-sm font-mono transition-all flex items-center justify-center gap-2"
            >
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Explore Technical Architecture</span>
            </button>
          </div>

          {/* Live Telemetry Ticker Cards */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl">
            <div className="p-5 rounded bg-[#0e131f]/90 border border-cyan-500/30 backdrop-blur reticle-box text-left">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1 uppercase">
                <span>Active Nodes</span>
                <Cpu className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-bold font-headline text-cyan-300">142 / 150</div>
              <div className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 98.4% Utilization Rate
              </div>
            </div>

            <div className="p-5 rounded bg-[#0e131f]/90 border border-emerald-500/30 backdrop-blur reticle-box text-left">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1 uppercase">
                <span>PIBT Collision Avoidance</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold font-headline text-emerald-300">4,289</div>
              <div className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 0 Deadlocks (ISO 3691-4)
              </div>
            </div>

            <div className="p-5 rounded bg-[#0e131f]/90 border border-amber-500/30 backdrop-blur reticle-box text-left">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1 uppercase">
                <span>Mesh Gossip Latency</span>
                <Radio className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-bold font-headline text-amber-300">0.8 ms</div>
              <div className="text-[11px] text-amber-400 font-mono mt-1 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> Sub-Millisecond Sync
              </div>
            </div>

            <div className="p-5 rounded bg-[#0e131f]/90 border border-cyan-500/30 backdrop-blur reticle-box text-left">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1 uppercase">
                <span>Facility Throughput</span>
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-bold font-headline text-white">18,420</div>
              <div className="text-[11px] text-cyan-300 font-mono mt-1 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Picks / Hour Nominal
              </div>
            </div>
          </div>
        </section>

        {/* TECHNOLOGY STACK & CORE INFRASTRUCTURE LOOP (React Bits LogoLoop) */}
        <section className="py-10 border-y border-slate-800/80 bg-black/70 backdrop-blur-md relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 mb-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                <span className="text-[11px] font-mono tracking-widest text-cyan-400 uppercase font-bold">
                  CORE TECHNOLOGIES & DISTRIBUTED STACK
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Engineered with modern reactive frameworks, sub-millisecond sockets & 60fps simulation canvas
              </p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-[#0e131f] border border-slate-800 text-slate-400">
              Interactive • Hover to Pause
            </span>
          </div>

          <LogoLoop
            logos={TECH_STACK_LOGOS}
            speed={65}
            direction="left"
            logoHeight={44}
            gap={20}
            hoverSpeed={0}
            scaleOnHover={true}
            fadeOut={true}
            fadeOutColor="#000000"
            ariaLabel="FleetSync Technology Stack & Languages"
          />
        </section>

        {/* FEATURE BENTO GRID SECTION */}
        <section id="features" className="py-16 px-6 lg:px-16 max-w-7xl mx-auto border-t border-cyan-500/20">
          <div className="text-center mb-12 space-y-2">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded">
              CORE CAPABILITIES & ENGINE SPECS
            </span>
            <h2 className="text-3xl font-headline font-bold text-white tracking-tight">
              Engineered for High-Density Fulfillment Centers
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded bg-[#0e131f]/90 border border-slate-800 hover:border-cyan-500/50 transition-all reticle-box space-y-4">
              <div className="w-12 h-12 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-headline font-bold text-cyan-300">Decentralized PIBT Swarm Routing</h3>
              <p className="text-xs text-slate-400 font-body leading-relaxed">
                Eliminate intersection deadlocks in narrow aisles. High-priority robots push lower-priority AGVs to temporary yield positions with sub-5ms path recomputation.
              </p>
            </div>

            <div className="p-6 rounded bg-[#0e131f]/90 border border-slate-800 hover:border-amber-500/50 transition-all reticle-box space-y-4">
              <div className="w-12 h-12 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <BatteryCharging className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-headline font-bold text-amber-300">Inductive Fast-Charge Matrix</h3>
              <p className="text-xs text-slate-400 font-body leading-relaxed">
                Sub-floor resonant charging coils automatically balance power reserves across active AGV mules, guaranteeing zero-wear 24/7 duty cycles.
              </p>
            </div>

            <div className="p-6 rounded bg-[#0e131f]/90 border border-slate-800 hover:border-emerald-500/50 transition-all reticle-box space-y-4">
              <div className="w-12 h-12 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-headline font-bold text-emerald-300">5.8GHz Mesh & Shared Perception</h3>
              <p className="text-xs text-slate-400 font-body leading-relaxed">
                Peer-to-peer gossip network broadcasting 100Hz real-time CAN-bus metrics and 360° solid-state LiDAR point-cloud maps without single points of failure.
              </p>
            </div>
          </div>
        </section>

        {/* BENCHMARK MAPS GALLERY */}
        <section id="benchmarks" className="py-16 px-6 lg:px-16 max-w-7xl mx-auto border-t border-cyan-500/20">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">SPATIAL BENCHMARK SUITE</span>
              <h2 className="text-3xl font-headline font-bold text-white tracking-tight mt-1">Pre-Configured Spatial Map Gallery</h2>
            </div>
            <p className="text-xs font-mono text-slate-400 max-w-md mt-2 md:mt-0">
              Select any MovingAI benchmark map below to instantly launch the live swarm simulation pre-loaded with that topology!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENCHMARK_CARDS.map(card => (
              <div
                key={card.id}
                className="p-6 rounded bg-[#0e131f]/90 border border-slate-800 hover:border-cyan-500/60 transition-all flex flex-col justify-between reticle-box group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                    {card.icon}
                  </div>
                  <h3 className="text-base font-headline font-bold text-white">{card.name}</h3>
                  <div className="text-xs font-mono text-cyan-400">{card.dim}</div>
                  <p className="text-xs text-slate-400 font-body">{card.desc}</p>
                </div>
                <button
                  onClick={() => onSelectBenchmarkMap(card.id)}
                  className="mt-6 w-full py-2.5 rounded bg-cyan-950/60 hover:bg-cyan-400 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 text-xs font-headline font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <span>Launch Benchmark</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* SYSTEM ARCHITECTURE BREAKDOWN */}
        <section id="architecture" className="py-16 px-6 lg:px-16 max-w-7xl mx-auto border-t border-cyan-500/20">
          <div className="text-center mb-12 space-y-2">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded">
              SYSTEM ARCHITECTURE & PROTOCOL
            </span>
            <h2 className="text-3xl font-headline font-bold text-white tracking-tight">
              Tri-Layer Distributed Warehouse Infrastructure
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 rounded bg-[#0e131f]/90 border border-cyan-500/30 reticle-box space-y-3">
              <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-[10px] font-bold">
                LAYER 01: PERCEPTION
              </span>
              <h3 className="text-lg font-headline font-bold text-cyan-300">Edge SLAM & LiDAR</h3>
              <p className="text-xs text-slate-400 font-body">
                360° Solid-state LiDAR (0.01m accuracy, 100m range), Dual depth stereo odometry, and EKF Extended Kalman Filter.
              </p>
            </div>

            <div className="p-6 rounded bg-[#0e131f]/90 border border-amber-500/30 reticle-box space-y-3">
              <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold">
                LAYER 02: ORCHESTRATION
              </span>
              <h3 className="text-lg font-headline font-bold text-amber-300">PIBT Swarm Engine</h3>
              <p className="text-xs text-slate-400 font-body">
                Priority-Inheritance Backtracking solver with lock-free peer-to-peer collision resolution and 3D space-time reservations.
              </p>
            </div>

            <div className="p-6 rounded bg-[#0e131f]/90 border border-emerald-500/30 reticle-box space-y-3">
              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                LAYER 03: POWER GRID
              </span>
              <h3 className="text-lg font-headline font-bold text-emerald-300">Inductive Power Network</h3>
              <p className="text-xs text-slate-400 font-body">
                Automatic low-battery dispatch to inductive charging pads, finite inventory stock tracking, and automated job completion routing.
              </p>
            </div>
          </div>

          <div className="p-8 rounded bg-[#0e131f] border border-cyan-500/40 flex flex-col md:flex-row items-center justify-between gap-6 reticle-box">
            <div>
              <h3 className="text-xl font-headline font-bold text-cyan-300 mb-2">Technical MAPF Specification Modal</h3>
              <p className="text-xs text-slate-400 max-w-xl font-mono">
                Inspect space-time reservation matrices, A* heuristic weights, PIBT yield state transitions, and WebSocket JSON payload schemas.
              </p>
            </div>
            <button
              onClick={() => setShowArchModal(true)}
              className="px-6 py-3 rounded bg-cyan-400 text-slate-950 font-headline text-xs font-bold uppercase tracking-wider hover:bg-cyan-300 transition-all shadow active:scale-95 glow-cyan"
            >
              <span>Open Technical Docs</span>
            </button>
          </div>
        </section>
      </main>

      {/* Technical Architecture Modal */}
      {showArchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-3xl p-6 rounded bg-[#0e131f] border border-cyan-500/40 shadow-2xl relative max-h-[85vh] flex flex-col reticle-box">
            <button
              onClick={() => setShowArchModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-headline font-bold text-cyan-300">FleetSync MAPF Engine Specification</h3>
                <p className="text-xs text-slate-400 font-mono">Multi-Agent Pathfinding Protocol (v4.8.2)</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 my-2 text-xs font-mono text-slate-300">
              <div className="p-4 rounded bg-[#161d2f] border border-slate-800">
                <h4 className="font-bold text-cyan-400 mb-1 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Priority-Inheritance Backtracking (PIBT)
                </h4>
                <p className="text-slate-400 leading-relaxed font-body text-xs">
                  PIBT assigns individual priorities to robots based on task distance and station urgency. When two robots attempt to occupy the same grid cell at tick <code>t</code>, the lower-priority robot yields its space or backtracks into an adjacent free cell, preventing narrow-aisle deadlocks.
                </p>
              </div>

              <div className="p-4 rounded bg-[#161d2f] border border-slate-800">
                <h4 className="font-bold text-indigo-400 mb-1 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Windowed Space-Time A* Reservation
                </h4>
                <p className="text-slate-400 leading-relaxed font-body text-xs">
                  The central reservation table tracks 3D coordinates <code>(x, y, time)</code>. Path planning searches the 3D space-time matrix to guarantee vertex and swap collision avoidance across future time horizons.
                </p>
              </div>

              <div className="p-4 rounded bg-[#161d2f] border border-slate-800">
                <h4 className="font-bold text-amber-400 mb-1 flex items-center gap-2">
                  <BatteryCharging className="w-4 h-4" /> Stock Depletion & Charging Hub Router
                </h4>
                <p className="text-slate-400 leading-relaxed font-body text-xs">
                  Pick stations have finite inventory. As AGVs complete deliveries, stock depletes naturally. When total pick stock reaches 0, the simulator broadcasts <strong>Job Finished</strong> and routes each AGV to dedicated charging pads.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowArchModal(false)}
                className="px-5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs transition-colors"
              >
                Close Technical Docs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 border-t border-cyan-500/20 px-6 lg:px-16 text-center text-xs font-mono text-slate-500 shrink-0 relative z-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 text-slate-400 font-medium font-headline">
            <img src="/logo-icon.png" alt="FleetSync" className="w-5 h-5 object-contain" />
            <span><span className="text-white font-semibold">FLEET</span><span className="text-cyan-400 font-semibold">SYNC</span> AI Swarm Coordinator</span>
          </div>
          <p>© 2026 FleetSync. Multi-Agent Pathfinding & Swarm Analytics Engine.</p>
        </div>
      </footer>
    </div>
  );
};
