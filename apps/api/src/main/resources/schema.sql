CREATE TABLE IF NOT EXISTS ghost_scenarios (id UUID PRIMARY KEY, name VARCHAR(160) NOT NULL, document JSONB NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS ghost_scenario_history (scenario_id UUID NOT NULL, revision INTEGER NOT NULL, document JSONB NOT NULL, action VARCHAR(16) NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(scenario_id,revision));
CREATE INDEX IF NOT EXISTS ghost_scenarios_updated_idx ON ghost_scenarios(updated_at DESC);

-- theghost-phase7a: null owner denotes legacy data; never auto-claim it.
ALTER TABLE ghost_scenarios ADD COLUMN IF NOT EXISTS owner_username VARCHAR(120);
CREATE INDEX IF NOT EXISTS ghost_scenarios_owner_idx ON ghost_scenarios(owner_username,updated_at DESC);

-- Phase 7C: persistent users; bootstrap administrator is inserted only once.
CREATE TABLE IF NOT EXISTS ghost_users (
 username VARCHAR(80) PRIMARY KEY,
 password_hash VARCHAR(100) NOT NULL,
 role VARCHAR(16) NOT NULL CHECK (role IN ('ADMIN','ANALYST')),
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ghost_security_audit (
 id BIGSERIAL PRIMARY KEY,
 actor VARCHAR(80) NOT NULL,
 action VARCHAR(64) NOT NULL,
 subject VARCHAR(160) NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ghost_security_audit_time_idx ON ghost_security_audit(occurred_at DESC);
