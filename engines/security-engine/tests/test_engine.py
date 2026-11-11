import pytest
from ghost_engine.fixtures import DEMO
from ghost_engine.engine import analyze, compare, optimize
from ghost_engine.models import OptimizationRequest

def test_demo_reaches_vault():
    result = analyze(DEMO)
    assert result["status"] == "supported_by_model"
    assert result["path"] == ["internet", "laptop", "identity", "gateway", "vault"]

def test_blocked_edge_prevents_reachability():
    result = compare(DEMO, ["identity->gateway"])
    assert result["alternate"]["status"] == "blocked_by_model"
    assert "vault" in result["removed_reachable"]

def test_fingerprint_is_reproducible():
    assert analyze(DEMO)["snapshot_sha256"] == analyze(DEMO)["snapshot_sha256"]

def test_optimizer_finds_verified_defense():
    req = OptimizationRequest.model_validate({"scenario": DEMO.model_dump(), "budget": 5,
        "candidates": [{"relationship": "identity->gateway", "cost": 2},
                       {"relationship": "gateway->vault", "cost": 1}]})
    result = optimize(req)
    assert result["status"] == "mitigation_found"
    assert result["cost"] == 1
    assert result["mitigations"] == ["gateway->vault"]

def test_invalid_references_rejected():
    data = DEMO.model_dump()
    data["target"] = "unknown"
    with pytest.raises(ValueError):
        from ghost_engine.models import Scenario
        Scenario.model_validate(data)


def test_optimizer_prefers_cheapest_over_fewest_controls():
    # Cheaper two-control solution beats an expensive one-control solution.
    from ghost_engine.models import Scenario
    data = DEMO.model_dump()
    data["relationships"].append({"source": "laptop", "target": "gateway", "kind": "connects", "requires": []})
    data["relationships"].append({"source": "identity", "target": "vault", "kind": "connects", "requires": []})
    # All paths end at the target via either gateway->vault or identity->vault.
    req = OptimizationRequest.model_validate({"scenario": Scenario.model_validate(data).model_dump(),
        "budget": 10, "candidates": [
            {"relationship": "internet->laptop", "cost": 9},
            {"relationship": "gateway->vault", "cost": 2},
            {"relationship": "identity->vault", "cost": 2}]})
    result = optimize(req)
    assert result["status"] == "mitigation_found"
    assert result["cost"] == 4
    assert result["mitigations"] == ["gateway->vault", "identity->vault"]


def test_optimizer_rejects_unknown_relationship():
    req = OptimizationRequest.model_validate({"scenario": DEMO.model_dump(), "budget": 3,
        "candidates": [{"relationship": "fake->edge", "cost": 1}]})
    with pytest.raises(ValueError, match="unknown relationship"):
        optimize(req)
