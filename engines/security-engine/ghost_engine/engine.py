"""Deterministic synthetic attack-path reasoning. No exploitation is performed."""
from collections import deque
from hashlib import sha256
import json
from .models import Scenario, OptimizationRequest

RULE_VERSION = "ghost-rule-v2"


def fingerprint(scenario: Scenario) -> str:
    canonical = json.dumps(scenario.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return sha256(canonical.encode()).hexdigest()


def analyze(scenario: Scenario) -> dict:
    # The engine explores monotonic knowledge states; prerequisites are explicit.
    # A relationship can be traversed only when all prerequisite assets are reached.
    blocked = set(scenario.blocked_relationships)
    reached = set(scenario.initial_access)
    parent = {a: None for a in scenario.initial_access}
    evidence = []
    iterations = 0
    while True:
        iterations += 1
        changed = False
        for index, edge in enumerate(scenario.relationships):
            edge_id = f"{edge.source}->{edge.target}"
            if not edge.enabled or edge_id in blocked:
                continue
            if edge.source in reached and edge.target not in reached and all(req in reached for req in edge.requires):
                reached.add(edge.target)
                parent[edge.target] = edge.source
                evidence.append({"rule": "reachability-with-prerequisites", "edge": edge_id, "kind": edge.kind, "requires": edge.requires, "index": index})
                changed = True
        if not changed:
            break
    path = []
    if scenario.target in reached:
        current = scenario.target
        while current is not None:
            path.append(current)
            current = parent[current]
        path.reverse()
    # 'blocked by model' is not proof that a real system is secure.
    return {"status": "supported_by_model" if path else "blocked_by_model", "path": path,
            "reachable": sorted(reached), "evidence": evidence, "iterations": iterations,
            "snapshot_sha256": fingerprint(scenario), "rule_version": RULE_VERSION,
            "disclaimer": "Synthetic model only; no real-world exploitability or security guarantee."}


def compare(scenario: Scenario, blocked: list[str]) -> dict:
    baseline = analyze(scenario)
    alternate = scenario.model_copy(deep=True)
    alternate.blocked_relationships = sorted(set(alternate.blocked_relationships) | set(blocked))
    modified = analyze(alternate)
    return {"baseline": baseline, "alternate": modified,
            "removed_reachable": sorted(set(baseline["reachable"]) - set(modified["reachable"])),
            "added_reachable": sorted(set(modified["reachable"]) - set(baseline["reachable"]))}


def optimize(request: OptimizationRequest) -> dict:
    # Bounded exact minimum-cost search; synthetic edges only.
    from itertools import combinations
    candidates = request.candidates
    if len(candidates) > 16:
        raise ValueError("Optimizer supports at most 16 candidate mitigations")
    baseline = analyze(request.scenario)
    if baseline["status"] == "blocked_by_model":
        return {"status": "already_blocked", "mitigations": [], "cost": 0,
                "verified": True, "algorithm": "bounded-exhaustive-min-cost-v2"}
    known = {f"{edge.source}->{edge.target}" for edge in request.scenario.relationships}
    if any(item.relationship not in known for item in candidates):
        raise ValueError("Mitigation references an unknown relationship")
    best = None
    for count in range(1, len(candidates) + 1):
        for combo in combinations(candidates, count):
            cost = sum(item.cost for item in combo)
            if cost > request.budget or (best is not None and cost > best[0]):
                continue
            blocked = sorted({item.relationship for item in combo})
            alternate = request.scenario.model_copy(deep=True)
            alternate.blocked_relationships = sorted(set(alternate.blocked_relationships) | set(blocked))
            if analyze(alternate)["status"] == "blocked_by_model":
                choice = (cost, len(blocked), blocked)
                if best is None or choice < best:
                    best = choice
    if best is not None:
        return {"status": "mitigation_found", "mitigations": best[2], "cost": best[0],
                "verified": True, "algorithm": "bounded-exhaustive-min-cost-v2"}
    return {"status": "not_found_within_budget", "mitigations": [], "cost": None,
            "verified": False, "algorithm": "bounded-exhaustive-min-cost-v2"}
