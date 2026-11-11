# Architecture

```text
Browser (React + TypeScript)
         |
         v
Spring Boot gateway (read-only synthetic demo routes)
         |
         v
FastAPI Python security engine
  - validated typed graph
  - prerequisite-aware monotonic state exploration
  - evidence trace + SHA-256 scenario fingerprint
  - scenario comparison
  - bounded exact mitigation search

PostgreSQL (provisioned; application persistence planned)
```

The public demo uses synthetic fixtures. It is **not** a multi-tenant authenticated private application. A future private service must have separate authentication, authorization, data ownership checks and audit persistence. The bounded exact optimizer is an educational reference algorithm, not an OR-Tools implementation or a scalable production solver.
