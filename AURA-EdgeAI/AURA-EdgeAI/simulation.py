from pathfinding import shortest_path

def initial_state():
    return {
        "width": 12, "height": 12, "step": 0,
        "offline_simulated": False,
        "obstacles": [[4,2],[4,3],[4,4],[7,6],[7,7],[2,8],[3,8]],
        "robots": [
            {"id":"R1","position":[0,0],"status":"active","task_id":None,"route":[],"completed":0,"stalled_steps":0},
            {"id":"R2","position":[0,10],"status":"active","task_id":None,"route":[],"completed":0,"stalled_steps":0},
            {"id":"R3","position":[10,0],"status":"active","task_id":None,"route":[],"completed":0,"stalled_steps":0},
            {"id":"R4","position":[10,10],"status":"active","task_id":None,"route":[],"completed":0,"stalled_steps":0},
        ],
        "tasks": [
            {"id":"T1","pickup":[3,2],"delivery":[5,9],"priority":3,"status":"pending","assigned_robot_id":None},
            {"id":"T2","pickup":[8,2],"delivery":[1,7],"priority":2,"status":"pending","assigned_robot_id":None},
            {"id":"T3","pickup":[6,9],"delivery":[10,5],"priority":1,"status":"pending","assigned_robot_id":None},
            {"id":"T4","pickup":[2,5],"delivery":[9,9],"priority":2,"status":"pending","assigned_robot_id":None},
        ],
        "logs": ["Simulation initialized. Local decision engine ready."],
        "alerts": [],
        "metrics": {"tasks_completed":0,"collisions_avoided":0,"reroutes":0,"failed_robots":0}
    }

def advance(state):
    state["step"] += 1
    # Assign pending tasks before movement.
    # Engine is called by api before this function.
    occupied_next = set()
    for robot in state["robots"]:
        if robot["status"] == "failed":
            continue
        if robot.get("stalled"):
            robot["stalled_steps"] += 1
            if robot["stalled_steps"] >= 3 and robot["task_id"]:
                state["alerts"].append(f'{robot["id"]} appears stalled for {robot["stalled_steps"]} steps.')
                state["alerts"] = state["alerts"][-10:]
            continue
        if robot["route"]:
            next_pos = robot["route"][1] if len(robot["route"]) > 1 else robot["route"][0]
            key = tuple(next_pos)
            if key in occupied_next:
                state["metrics"]["collisions_avoided"] += 1
                state["logs"].append(f'{robot["id"]} waited to avoid a cell conflict.')
                continue
            occupied_next.add(key)
            robot["position"] = list(next_pos)
            robot["route"] = robot["route"][1:] if len(robot["route"]) > 1 else []
        if robot["task_id"] and not robot["route"]:
            task = next((t for t in state["tasks"] if t["id"] == robot["task_id"]), None)
            if task:
                if robot["position"] == task["pickup"]:
                    route = shortest_path(robot["position"], task["delivery"], state["obstacles"], state["width"], state["height"])
                    if route:
                        robot["route"] = route
                        task["status"] = "delivering"
                        state["logs"].append(f'{robot["id"]} picked up {task["id"]}; delivery route planned.')
                    else:
                        state["logs"].append(f'No feasible delivery route for {task["id"]}.')
                elif robot["position"] == task["delivery"]:
                    task["status"] = "completed"
                    robot["completed"] += 1
                    robot["task_id"] = None
                    robot["status"] = "active"
                    state["metrics"]["tasks_completed"] += 1
                    state["logs"].append(f'{robot["id"]} completed {task["id"]}.')
    state["logs"] = state["logs"][-40:]
    return state
