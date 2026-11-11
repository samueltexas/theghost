import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .models import Scenario, OptimizationRequest
from .fixtures import DEMO
from .engine import analyze, compare, optimize
from pydantic import BaseModel, Field

app = FastAPI(title="theghost security engine", version="0.1.0", docs_url=None, redoc_url=None)
# The engine is local-only and intentionally accepts no real credentials or network targets.
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

class ComparisonRequest(BaseModel):
    scenario: Scenario
    blocked: list[str] = Field(max_length=100)

@app.get("/health")
def health():
    return {"status": "ok", "service": "security-engine"}

@app.get("/demo/scenario")
def demo_scenario():
    return DEMO.model_dump()

@app.get("/demo/analysis")
def demo_analysis():
    return analyze(DEMO)

@app.post("/analyze")
def analyze_scenario(scenario: Scenario):
    return analyze(scenario)

@app.post("/compare")
def compare_scenarios(request: ComparisonRequest):
    return compare(request.scenario, request.blocked)

@app.post("/optimize")
def optimize_defenses(request: OptimizationRequest):
    try:
        return optimize(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
