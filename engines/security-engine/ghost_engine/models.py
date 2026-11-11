from typing import Literal
from pydantic import BaseModel, Field, model_validator

AssetKind = Literal["workstation", "server", "identity", "database", "network", "service"]

class Asset(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")
    name: str = Field(min_length=1, max_length=120)
    kind: AssetKind
    criticality: int = Field(default=3, ge=1, le=5)

class Relationship(BaseModel):
    source: str
    target: str
    kind: Literal["connects", "trusts", "administers", "authenticates", "contains"]
    enabled: bool = True
    requires: list[str] = Field(default_factory=list, max_length=8)

class Scenario(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    assets: list[Asset] = Field(min_length=1, max_length=200)
    relationships: list[Relationship] = Field(default_factory=list, max_length=1000)
    initial_access: list[str] = Field(min_length=1, max_length=20)
    target: str
    blocked_relationships: list[str] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_references(self):
        ids = [a.id for a in self.assets]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate asset IDs")
        known = set(ids)
        if self.target not in known or any(x not in known for x in self.initial_access):
            raise ValueError("Target or initial access references an unknown asset")
        for r in self.relationships:
            if r.source not in known or r.target not in known:
                raise ValueError("Relationship references an unknown asset")
            if any(x not in known for x in r.requires):
                raise ValueError("Precondition references an unknown asset")
        return self

class Mitigation(BaseModel):
    relationship: str
    cost: int = Field(ge=1, le=100)

class OptimizationRequest(BaseModel):
    scenario: Scenario
    candidates: list[Mitigation] = Field(max_length=100)
    budget: int = Field(default=10, ge=0, le=1000)
