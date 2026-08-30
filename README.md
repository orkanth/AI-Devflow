# DevFlow AI

Nx monorepo prototype of an **agentic engineering project-management platform**. Built to be explained in job interviews: every layer exists for a reason, and the code matches the architecture diagram.

```
                         DEVFLOW AI
                             │
                             ▼
                    ┌─────────────────┐
                    │     Angular     │  apps/web
                    │   Frontend/UI   │
                    └────────┬────────┘
                             │ REST / WS
                    ┌────────▼────────┐
                    │     NestJS      │  apps/api
                    │ Business/API    │  Users · Projects · Tasks
                    └────────┬────────┘
                             │
                       PostgreSQL + pgvector
                             ▲
                    ┌────────┴────────┐
                    │     FastAPI     │  apps/ai-service
                    │   Python AI     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    LangGraph    │
                    │   Supervisor    │
                    └────────┬────────┘
             ┌───────────────┼────────────────┐
             ▼               ▼                ▼
        Task Agent       RAG Agent       Analytics Agent
             │               │                │
        Tool calling      embeddings      aggregates
             │               │                │
          NestJS          pgvector        PostgreSQL / NestJS
```

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Angular 22 + Angular Material (same chrome as [orkanth/devflow](https://github.com/orkanth/devflow)) |
| Backend | NestJS 11 |
| AI | FastAPI + LangGraph-style supervisor |
| Data | PostgreSQL + pgvector (in-memory adapter by default) |
| Monorepo | Nx 23 |

## Apps

| App | Path | Port | Responsibility |
| --- | --- | --- | --- |
| Angular UI | `apps/web` | 4200 | Dashboard, CRUD screens, AI console, interview notes |
| NestJS API | `apps/api` | 3333 | System of record for users, projects, tasks; AI proxy + WebSocket |
| FastAPI AI | `apps/ai-service` | 8000 | LangGraph supervisor, RAG, MCP-style tools, evaluation |
| Postgres | `docker-compose.yml` | 5432 | OLTP + `pgvector` (optional; in-memory adapter is the default) |

## Quick start

```bash
npm install
python3 -m pip install -r apps/ai-service/requirements.txt

# three terminals
npx nx serve api
npx nx serve ai-service
npx nx serve web
```

Open http://localhost:4200

Optional database:

```bash
docker compose up -d
```

The prototype **does not require Docker or an OpenAI key**. Embeddings are a deterministic hashing trick (same algorithm in NestJS and Python). NestJS falls back to a local supervisor if FastAPI is down.

## Why this split (the 30-second interview answer)

- **Angular** renders the product and talks HTTP. It never owns business rules.
- **NestJS** is the **system of record**. Authorization, validation, and writes live here.
- **FastAPI + LangGraph** is the **reasoning plane**. Agents call tools; they do not store tasks themselves.
- **PostgreSQL** holds relational data. **pgvector** stores embeddings next to that data so RAG is not a second product database.
- **Nx** keeps TypeScript and Python apps in one graph: `nx test api`, `nx test ai-service`, `nx graph`.

## Learn the stack

Read [`docs/INTERVIEW_GUIDE.md`](docs/INTERVIEW_GUIDE.md) — deep explanations of Nx, Angular, NestJS, FastAPI, Pydantic, LangChain/LangGraph, RAG, embeddings, tool calling, agents, MCP, evaluation, PostgreSQL, and pgvector.

## Node note

Angular 22 wants Node `>= 22.22`. If `nx serve web` fails on an older 22.x, upgrade Node or use the NestJS/FastAPI APIs directly (`http://localhost:3333/api`, `http://localhost:8000/docs`).
