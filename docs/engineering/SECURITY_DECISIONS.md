# Engineering & Security Decisions

> Scope: documented decisions for the current local synthetic-model prototype. Implementation claims should be cross-checked against the source and tests before presenting them as independently verified security guarantees.

## Why a deterministic security engine?

The Python security engine evaluates a structured graph of synthetic assets and relationships. A deterministic rule set is preferable here to a generative model because identical inputs and rule versions can be evaluated reproducibly. This supports debugging, regression testing and evidence traceability. Scenario fingerprints use SHA-256 to help identify the modeled input; a fingerprint is not a security certification.

**Trade-off:** deterministic analysis is bounded by the completeness and correctness of the model and rules. It cannot infer unknown real-world vulnerabilities or prove exploitability.

## How are invalid modeled attack paths constrained?

Relationships carry explicit direction and, where applicable, prerequisites. Reachability is calculated from modeled entry points rather than assuming every visually connected node is reachable. The engine should report a supported path only when the applicable rules and prerequisites are satisfied. This reduces unsupported *model-level* paths; it does not establish the absence of real-world false positives or false negatives.

## Evidence and provenance

The engine exposes rule identifiers, relationship references, a rule version and a scenario fingerprint alongside its modeled results. This makes it possible to trace a reported path back to the inputs and the rules used. The UI labels unverified results separately and avoids treating synthetic reachability as real-world exploitability.

## Scenario ownership and authorization

The Spring Boot API uses authenticated sessions and role-based permissions (ADMIN and ANALYST). PostgreSQL-backed scenario operations apply ownership checks. A user interface label is not an authorization boundary: access control must be enforced server-side. See the security tests for concrete authorization cases and coverage.

## Application security choices

- **Password storage:** BCrypt password hashing rather than reversible storage.
- **Session and CSRF controls:** authenticated sessions and CSRF protection for state-changing requests.
- **RBAC and ownership:** explicit role checks and per-scenario access restrictions.
- **Login abuse resistance:** login attempt rate limiting.
- **Auditability:** security events recorded for relevant actions; logs are not a substitute for continuous monitoring.
- **Network boundary:** development services bound to loopback; Docker Compose is for local operation, not a production deployment.
- **Secrets:** real credentials belong in an ignored local `.env`, never in tracked examples, screenshots or logs.

## Why the investigator is not presented as an LLM

The current investigator generates rule-based, evidence-grounded answers from the synthetic scenario and engine output. **No LLM is connected in this release.** The name in the UI does not imply generative AI capability.

## Future decisions

Production hardening, independent security assessment, scalable optimization, advanced lab orchestration and LLM integration remain future work. Their presence in a roadmap must not be interpreted as completed functionality.
