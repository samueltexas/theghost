# Threat Model — Local Synthetic Prototype

**Status:** design-level documentation, not an independent penetration test or certification.

## Scope

The application consists of a React client, Spring Boot API, PostgreSQL and a Python synthetic-analysis engine, operated locally through Docker Compose.

## Assets and trust boundaries

- Authentication credentials and password hashes.
- Session state and authorization decisions.
- User-owned scenario records and revision history.
- Security audit records.
- Synthetic analysis inputs and evidence outputs.
- Local environment secrets and Docker configuration.

## Security considerations

| Area | Risk to consider | Documented control or boundary | Evidence to verify |
| --- | --- | --- | --- |
| Authentication | Unauthorized account access | BCrypt, session authentication, login rate limiting | Authentication tests and configuration |
| State-changing requests | Cross-site request forgery | CSRF protection | CSRF security tests |
| Authorization | Access across users or roles | ADMIN/ANALYST roles and scenario ownership checks | Negative authorization tests |
| Input handling | Malformed or unexpected scenario data | Structured synthetic scenario inputs | Input validation tests |
| Secrets | Credential disclosure | Ignored `.env`, sanitized `.env.example` | Git history and tracked-file checks |
| Auditability | Insufficient accountability | Security event audit records | Event tests and sanitized sample logs |
| Network exposure | Unintended public access | Loopback-only development ports | Compose configuration |
| Analysis correctness | Misleading modeled paths | Explicit graph rules, prerequisites and evidence | Engine unit tests and test fixtures |

## Out of scope

A public production deployment, real infrastructure scanning, external exploitation testing, third-party security assessment, security guarantees and LLM-based decisions are not covered by the verified local release.

## Residual risk

Automated tests and local smoke checks increase confidence in specific behavior but do not prove the absence of vulnerabilities. Review the actual source and current test output before using any result as a formal assurance claim.
