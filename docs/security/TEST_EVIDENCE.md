# Technical Evidence & Verification

This document separates **reported completed checks** from **reproducible verification steps**. Test output should be captured afresh for each tagged release; do not publish fabricated logs or imply an external audit.

## Reported local validation

- Java security test suite: **13 tests passed** in the local development workflow.
- Frontend: Vite production build completed successfully.
- Docker Compose: frontend, API, Python engine and PostgreSQL started locally.
- `scripts/smoke.sh`: API health, engine health and synthetic demo analysis returned successful results.
- Example synthetic analysis: `supported_by_model`, with rule version `ghost-rule-v2`, path/evidence records and a scenario SHA-256 fingerprint.

These results were reported during local development; they are not a signed CI attestation or an independent security audit.

## Reproduce the smoke check

From the repository root, with Docker Desktop running and the local `.env` correctly configured:

```bash
docker compose up --build -d
docker compose ps
sh scripts/smoke.sh
```

## What security tests should demonstrate

- Successful and failed authentication behavior.
- CSRF rejection for relevant state-changing requests.
- Role-based access denial for unauthorized actions.
- Scenario ownership denial across accounts.
- Audit event creation for the tested security events.
- Correct handling of synthetic engine evidence and prerequisites.

**Coverage note:** the checklist above is a verification target, not a claim that every case is covered by the current 13 tests. Check the actual test names and assertions before marking each case complete.

## Safe evidence publication

Publish only sanitized test output and synthetic fixtures. Do not commit `.env`, access tokens, session cookies, password hashes, private scenario content or raw audit logs containing personal data.
