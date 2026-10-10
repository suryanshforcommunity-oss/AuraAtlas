from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel
from simulation import initial_state, advance
from edge_engine import EdgeDecisionEngine
from pathfinding import shortest_path

ROOT = Path(__file__).resolve().parent
app = FastAPI(title="AURA EdgeAI", description="Local warehouse robot decision engine demo")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
state = initial_state()
engine = EdgeDecisionEngine()

class Cell(BaseModel):
    x: int
    y: int
class RobotAction(BaseModel):
    robot_id: str

@app.get("/")
def home():
    return FileResponse(ROOT / "index.html")

@app.get("/state")
def get_state():
    return state

@app.get("/edge/status")
def edge_status():
    return engine.status()

@app.post("/step")
def step():
    decisions = engine.choose_assignment(state)
    for d in decisions:
        if d.get("robot_id"):
            state["logs"].append(f'{d["robot_id"]} assigned {d["task_id"]} via {d["method"]}: {d["reason"]}')
        else:
            state["logs"].append(f'{d["task_id"]}: {d["reason"]}')
    advance(state)
    return {"state": state, "decisions": decisions, "edge": engine.status()}

@app.post("/train")
def train_model():
    result = engine.train_local_model(state)
    state["logs"].append(f"Local ML model trained (run #{result['training_runs']}). Decision mode switched to ML_MODEL.")
    state["logs"] = state["logs"][-40:]
    return {"ok": True, "result": result, "edge": engine.status()}

@app.post("/offline/{enabled}")
def set_offline(enabled: bool):
    state["offline_simulated"] = enabled
    state["logs"].append("Simulated cloud unavailable; local decisions continue." if enabled else "Offline simulation disabled.")
    state["logs"] = state["logs"][-40:]
    return {"offline_simulated": enabled, "cloud_required": False}

@app.post("/obstacle")
def toggle_obstacle(cell: Cell):
    x, y = cell.x, cell.y
    if not (0 <= x < state["width"] and 0 <= y < state["height"]):
        raise HTTPException(400, "Cell is outside the warehouse grid.")
    pos = [x,y]
    if pos in state["obstacles"]:
        state["obstacles"].remove(pos)
        msg = f"Obstacle removed at ({x},{y})."
    else:
        state["obstacles"].append(pos)
        msg = f"Obstacle added at ({x},{y}); new paths will avoid it."
        for robot in state["robots"]:
            if robot.get("route") and pos in robot["route"]:
                robot["route"] = shortest_path(robot["position"], robot["route"][-1], state["obstacles"], state["width"], state["height"])
                state["metrics"]["reroutes"] += 1
    state["logs"].append(msg)
    state["logs"] = state["logs"][-40:]
    return {"message": msg, "state": state}

@app.post("/fail")
def fail_robot(action: RobotAction):
    robot = next((r for r in state["robots"] if r["id"] == action.robot_id), None)
    if not robot:
        raise HTTPException(404, "Robot not found.")
    robot["status"] = "failed"
    task_id = robot.get("task_id")
    robot["task_id"] = None
    robot["route"] = []
    state["metrics"]["failed_robots"] += 1
    if task_id:
        task = next((t for t in state["tasks"] if t["id"] == task_id), None)
        if task and task["status"] != "completed":
            task["status"] = "pending"
            task["assigned_robot_id"] = None
    state["logs"].append(f'{robot["id"]} failed. Any unfinished task returned to queue.')
    state["logs"] = state["logs"][-40:]
    return state

@app.post("/reset")
def reset():
    global state, engine
    state = initial_state()
    engine = EdgeDecisionEngine()
    return state
