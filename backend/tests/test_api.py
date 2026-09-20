import sys
from pathlib import Path
import pytest

PROJECT_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_root():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["platform"] == "FlowSight AI"
    assert "Hyderabad" in data["network"]


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_topology():
    res = client.get("/api/network/topology")
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) == 120
    assert len(data["segments"]) == 436


def test_current_traffic():
    res = client.get("/api/traffic/current")
    assert res.status_code == 200
    data = res.json()
    assert "network_kpi" in data
    assert len(data["segments"]) == 436


def test_forecast():
    res = client.get("/api/forecast/R0001")
    assert res.status_code == 200
    data = res.json()
    assert len(data["horizons"]) == 4
    assert data["horizons"][0]["horizon_minutes"] == 15


def test_bottlenecks():
    res = client.get("/api/bottlenecks")
    assert res.status_code == 200
    data = res.json()
    assert data["total_bottlenecks"] == 16


def test_diversion_simulation():
    payload = {
        "segment_id": "R0001",
        "baseline_flow_vph": 1800.0,
        "diversion_pct": 0.20
    }
    res = client.post("/api/simulation/diversion", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "impact_summary" in data
    assert data["diversion_percentage"] == 20


def test_infrastructure_simulation():
    payload = {
        "candidate_id": "PLAN0376",
        "baseline_flow_vph": 2000.0
    }
    res = client.post("/api/simulation/infrastructure", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "evaluated_impact" in data
    assert data["evaluated_impact"]["delay_reduction_pct"] > 0


def test_data_quality():
    res = client.get("/api/data-quality")
    assert res.status_code == 200
    data = res.json()
    assert data["total_datasets_validated"] == 17


def test_system_status():
    res = client.get("/api/system/status")
    assert res.status_code == 200
    data = res.json()
    assert data["backend"]["status"] == "READY"
    assert "database" in data
    assert data["models"]["forecast"] == "READY"
    assert data["network"]["segments_count"] == 436


if __name__ == "__main__":
    print("Running integration tests...")
    test_root()
    test_health()
    test_system_status()
    test_topology()
    test_current_traffic()
    test_forecast()
    test_bottlenecks()
    test_diversion_simulation()
    test_infrastructure_simulation()
    test_data_quality()
    print("All integration tests PASSED!")
