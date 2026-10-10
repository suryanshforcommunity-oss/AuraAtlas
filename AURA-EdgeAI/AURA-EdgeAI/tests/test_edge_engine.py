from edge_engine import EdgeDecisionEngine
from simulation import initial_state
from pathfinding import shortest_path
from fastapi.testclient import TestClient
import api

def test_local_fallback_and_assignment():
    state = initial_state()
    engine = EdgeDecisionEngine()
    decisions = engine.choose_assignment(state)
    assert engine.status()["cloud_required"] is False
    assert engine.status()["fallback_active"] is True
    assert any(d.get("robot_id") for d in decisions)

def test_path_avoids_obstacles():
    path = shortest_path([0,0], [3,0], [[1,0],[1,1]], 5, 5)
    assert path
    assert not any(p in [[1,0],[1,1]] for p in path)

def test_api_status_and_offline():
    client = TestClient(api.app)
    assert client.get("/edge/status").status_code == 200
    r = client.post("/offline/true")
    assert r.status_code == 200
    assert r.json()["cloud_required"] is False

def test_failed_robot_not_assigned():
    state = initial_state()
    state["robots"][0]["status"] = "failed"
    engine = EdgeDecisionEngine()
    decisions = engine.choose_assignment(state)
    assert all(d.get("robot_id") != "R1" for d in decisions)
