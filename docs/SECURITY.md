# Security model and limitations

## Scope

This package contains a synthetic cybersecurity modeling prototype. It does not conduct vulnerability scanning, exploitation, credential collection, or external network discovery.

## Implemented protections

- Pydantic input validation and bounded asset/relationship counts.
- Deterministic model analysis with SHA-256 fingerprints and rule version.
- No arbitrary code execution or shell commands from scenario payloads.
- Strict route allowlist in the Java gateway.
- Container privilege reduction on the Python engine.
- Loopback-only host port bindings for local development.
- Secret file excluded from Git; random local PostgreSQL password generation.
- Clear distinction between model-supported paths and real-world exploitability.

## Not implemented — must be addressed before any public deployment

- Authentication, RBAC, per-tenant authorization, CSRF protection for authenticated sessions.
- Database row-level or equivalent organization isolation.
- Public demo rate limiting, quotas, and abuse prevention.
- Security event persistence, append-only audit logs, encryption-at-rest strategy.
- Full Docker Lab isolation and control-plane threat model.
- Signed builds, SBOM, automated SAST/DAST, supply-chain attestations.
- Independent penetration testing and operational incident response.

Never expose the API as a production service without implementing the missing controls. A blocked model path is not evidence of security outside the modeled assumptions.
