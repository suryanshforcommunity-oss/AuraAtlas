# ⚡ FleetSync: Autonomous AGV Swarm Coordinator

> **Decentralized Priority-Inheritance Backtracking (PIBT) & Multi-Agent Pathfinding (MAPF) Engine for High-Density Fulfillment Centers.**

![FleetSync Swarm Coordinator](https://img.shields.io/badge/FleetSync-v4.8.2-cyan?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)
![React](https://img.shields.io/badge/React-18.3-61dafb?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite)
![Node.js](https://img.shields.io/badge/Node.js-22-green?style=for-the-badge&logo=node.js)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=for-the-badge&logo=tailwindcss)

---

## 📖 Overview

**FleetSync** is an industrial-grade autonomous warehouse AGV (Automated Guided Vehicle) swarm orchestration platform. Powered by **Priority-Inheritance Backtracking (PIBT)** and **3D Space-Time Reservation Tables**, FleetSync resolves intersection deadlocks, prevents vertex/swap collisions in narrow aisles, dynamically balances inductive charging reserves, and routes fleets across high-density storage grids in real time.

---

## 🚀 Key Features

- 🤖 **Decentralized Swarm Coordination**: Sub-5ms conflict resolution using Priority-Inheritance Backtracking (PIBT).
- ⏱️ **3D Space-Time Matrix Reservations**: Guaranteed vertex and edge-swap collision-free routing over future time horizons $(x, y, t)$.
- 🔋 **Inductive Power Grid & Dynamic Balancing**: Autonomous low-battery detection ($<15\%$), inductive pad navigation, dynamic recharge cycles ($100\%$), and resumption of pending orders.
- 📦 **Dynamic Payload & Order Fulfillment**: Real-time load capacity balancing (1–4 parcels/AGV), pickup urgency prioritization, drop dock quotas (99 cap), and automatic job completion states.
- 🗺️ **MovingAI Spatial Benchmark Topologies**:
  - `Structured Pod Warehouse` (36 × 28 Grid)
  - `Warehouse 10-20 Small Pods` (36 × 24 Grid)
  - `Warehouse 20-40 Distribution Hub` (48 × 32 Large Grid)
  - `Maze Nexus 32×32`
  - `Random Scatter Obstacles 32×32`
  - `Open Fleet Arena 32×32`
- 📊 **Real-Time Telemetry & Analytics**: Real-time telemetry streaming over WebSockets (100Hz updates, active robot nodes, collision counters, gossip latency, pick rates).
- 🌌 **Immersive Modern UI**: Built with React 18, Tailwind CSS, Lucide icons, OGL WebGL shaders (Galaxy & Prism), and Luminous Typography.

---

## 🛠️ Tech Stack

### Frontend / Client
- **Framework**: React 18 + TypeScript
- **Bundler**: Vite 6
- **Styling**: Tailwind CSS + Custom CSS Reticle & Glow Tokens
- **Icons**: Lucide React
- **Graphics / Shaders**: OGL WebGL (Galaxy Starfield, Prism 3D)

### Backend / Server
- **Runtime**: Node.js + TypeScript (`tsx`)
- **Web Framework**: Express.js + CORS
- **Real-Time Protocol**: WebSockets (`ws`)
- **MAPF Engine**: Priority-Inheritance Backtracking (PIBT), Space-Time A*, MovingAI `.map` parser

---

## 💻 Installation & Setup Guide

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Node.js**: `v18.0.0` or higher (Recommended: `v20.x` or `v22.x`)
- **npm**: `v9.x` or higher (bundled with Node.js)
- **Git**

---

### 2. Clone the Repository
```bash
git clone https://github.com/suryanshforcommunity-oss/Fleet4.git
cd Fleet4
```

---

### 3. Install Dependencies
Install all required client and server dependencies:
```bash
npm install
```

---

### 4. Running in Development Mode

Run both the **Backend WebSocket Server** and **Frontend Vite Client** concurrently:
```bash
npm run dev
```

The application will be accessible at:
- **Frontend UI**: [http://localhost:5000](http://localhost:5000) (or Vite assigned port)
- **Backend API & WebSocket Server**: [http://localhost:8080](http://localhost:8080) (`ws://localhost:8080`)

#### Running Individual Services:
- **Client only**:
  ```bash
  npm run dev:client
  ```
- **Server only**:
  ```bash
  npm run dev:server
  ```

---

### 5. Production Build

To compile TypeScript and bundle static assets for production deployment:
```bash
npm run build
```
Production build artifacts will be generated in the `dist/` directory.

To start the production server:
```bash
npm start
```

---

## 📂 Project Structure

```text
FleetSync/
├── server/                    # Backend MAPF & Swarm Simulation Server
│   ├── maps/                  # MovingAI spatial map definitions (.map)
│   └── src/
│       ├── index.ts           # Express & WebSocket entrypoint
│       └── sim/
│           ├── Agent.ts       # AGV state machine, battery & task handlers
│           ├── Grid.ts        # Collision avoidance, space-time reservation & PIBT
│           ├── MapParser.ts   # MovingAI parser (.map format)
│           └── Simulation.ts  # Swarm tick loop & telemetry broadcaster
├── src/                       # Frontend React Application
│   ├── components/            # UI Components
│   │   ├── CipherReveal.tsx   # Scrambled text decoder effect
│   │   ├── Galaxy.tsx         # Optimized WebGL Starfield shader
│   │   ├── GhostType.tsx      # AI predictive ghost-completion typing effect
│   │   ├── LandingPage.tsx    # FleetSync main landing portal & map selector
│   │   ├── LuminousType.tsx   # Drifting spotlight text illumination effect
│   │   ├── Prism.tsx          # 3D WebGL Prism shader
│   │   ├── Topbar.tsx         # Telemetry bar & controls
│   │   ├── WarehouseCanvas.tsx# 2D Interactive HTML5 Canvas Grid Renderer
│   │   └── WarehouseControlSidebar.tsx # Real-time AGV controls & stock adjustment
│   ├── types.ts               # Shared TypeScript schemas
│   ├── App.tsx                # Main App Router & WebSocket client
│   ├── main.tsx               # React DOM Entrypoint
│   └── index.css              # Custom cyber-industrial styling tokens
├── index.html                 # HTML entrypoint
├── package.json               # Project manifest & scripts
├── tailwind.config.js         # Tailwind styling configuration
├── tsconfig.json              # TypeScript compiler configuration
└── vite.config.ts             # Vite build configuration
```

---

## 📡 WebSocket Protocol & Telemetry Payloads

The client connects to `ws://localhost:8080` to receive 100Hz real-time telemetry frames:

```json
{
  "type": "TICK",
  "tick": 4280,
  "grid": { "width": 36, "height": 28 },
  "agents": [
    {
      "id": "AGV-01",
      "x": 14,
      "y": 8,
      "battery": 94,
      "status": "DELIVERING",
      "currentLoad": 4,
      "maxCapacity": 4,
      "currentPath": [{"x": 14, "y": 8, "t": 4280}, {"x": 15, "y": 8, "t": 4281}]
    }
  ],
  "stations": {
    "pickups": [{ "id": "P1", "x": 2, "y": 4, "stock": 48, "priority": "HIGH" }],
    "dropoffs": [{ "id": "D1", "x": 34, "y": 4, "delivered": 16, "capacity": 99 }],
    "charging": [{ "id": "C1", "x": 2, "y": 26, "occupied": false }]
  },
  "metrics": {
    "totalCollisionsAvoided": 4289,
    "throughputPicksPerHour": 18420,
    "activeFleetSize": 142,
    "meshLatencyMs": 0.8
  }
}
```

---

## 🤝 Contributing & License

Contributions are welcome! Please feel free to open issues or submit pull requests.

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  <b>FleetSync MAPF Engine</b> • Built for Next-Generation Autonomous Logistics
</p>
