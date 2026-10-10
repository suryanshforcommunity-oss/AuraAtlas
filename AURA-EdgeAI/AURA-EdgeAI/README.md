# AURA EdgeAI — Local Robot Decision Engine

A small standalone warehouse-robot coordination demo. It runs locally and does not call cloud AI APIs.

## Windows setup

Open PowerShell in this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000 for the dashboard or http://127.0.0.1:8000/docs for API docs.

## Tests

In a second PowerShell window, from this folder:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pytest -q
```

## Edge AI honesty note

This starter uses deterministic local rule-based assignment and obstacle-aware pathfinding. It reports `RULE_FALLBACK` because no trained ML model is included. It demonstrates local/offline-capable decision logic, not dedicated edge hardware or a trained production model. The offline toggle is a simulation of cloud unavailability, not a physical network disconnection.
