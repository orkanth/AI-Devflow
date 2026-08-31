# Architecture decision records (short)

## ADR 001 — NestJS is the system of record

Agents must not persist Users/Projects/Tasks in Python. All writes go through NestJS HTTP tools so validation and future auth stay in one place.

## ADR 002 — In-memory adapter first, Postgres schema ready

The laptop demo cannot assume Docker. Domain models and `infra/postgres/init.sql` match. Swap `MemoryStore` for TypeORM without changing controllers.

## ADR 003 — Hashing-trick embeddings

Neural embeddings need a vendor or a large model. A 64-d hashing trick is deterministic, shared across Node and Python, and is replaced by changing one function (`embed`).

## ADR 004 — Supervisor graph, not a single mega-prompt

Routing to specialist agents keeps tool permissions narrow (task agent can write; RAG agent cannot).
