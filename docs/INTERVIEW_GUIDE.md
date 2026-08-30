# DevFlow AI — interview study guide

This document is the “why” behind every box in the architecture. Use it as a spoken script. The code in this repo is a working miniature of the same ideas.

---

## 1. Nx (the monorepo)

**What it is.** Nx is a build system and workspace tool for polyglot monorepos. One Git repo holds multiple applications and libraries. Nx knows the *project graph*: `web` depends on the API contract, `api` is a Nest app, `ai-service` is Python.

**What problem it solves.** Without a monorepo you duplicate types, CI, and versioning across “frontend repo / backend repo / ml repo”. Interviews love this tradeoff:

| Monorepo | Polyrepo |
| --- | --- |
| Atomic PRs across UI + API | Independent release cadences |
| Shared lint/test commands | Clear ownership boundaries |
| Risk of coupling | Risk of drift |

**Commands that matter.**

- `nx serve web` / `nx serve api` / `nx serve ai-service` — run one app.
- `nx test api` — Jest for Nest.
- `nx test ai-service` — pytest via `nx:run-commands`.
- `nx graph` — visualize dependencies (excellent live demo).
- `nx affected -t test` — only test what a PR changed.

**How we used it here.** Integrated workspace (not npm workspaces-first). Angular and Nest are first-class `@nx/*` plugins. Python is an Nx project with `project.json` targets so it still shows up in the graph.

**Sound-bite.** “Nx is not the product. It is how we keep Angular, Nest, and Python in one CI graph without three snowflake pipelines.”

---

## 2. Angular (frontend / UI)

**What it is.** A batteries-included TypeScript UI framework: components, router, HttpClient, forms, dependency injection.

**Why Angular for this product.** Engineering PM tools are *application UIs* (dashboards, tables, forms), not content sites. Angular’s DI and router scale to that. Standalone components + signals are the modern style (this repo uses both).

**How data flows.**

1. User clicks **Create task**.
2. Component calls `ApiService.createTask`.
3. `HttpClient` hits `/api/tasks` (dev-server **proxy** → Nest `:3333`).
4. Nest validates with `class-validator` and writes to the store.
5. UI refreshes the list from GET.

**Proxy vs CORS.** `apps/web/proxy.conf.json` forwards `/api` in development so the browser origin stays `:4200`. Production would put Angular and Nest behind one reverse proxy, or enable CORS (this API also `enableCors()`).

**WebSockets.** Nest exposes namespace `/ai` (Socket.IO). REST `POST /api/ai/chat` is the path the UI uses so the demo works with HttpClient alone. In an interview: REST for request/response, WS for streaming tokens and live traces.

**Sound-bite.** “The UI is a client of the business API. It does not embed LangGraph or SQL.”

---

## 3. NestJS (business / API layer)

**What it is.** A Node framework that looks like Angular on the server: modules, providers, controllers, pipes, guards, interceptors.

**Why it owns Users, Projects, Tasks.** That triangle is the **system of record**. Whoever writes those rows owns:

- validation (`ValidationPipe` + DTOs)
- identity and authorization (guards — add JWT next)
- transactions and invariants (“task belongs to a real project”)
- HTTP/WebSocket contracts the UI depends on

If the Python agent wrote tasks into its own SQLite file, you would have two sources of truth. The task agent therefore **calls NestJS tools**.

**Module map in this repo.**

- `UsersModule` / `ProjectsModule` / `TasksModule` — domain CRUD
- `KnowledgeModule` — ingest + cosine search (RAG corpus)
- `AiModule` — REST + Socket.IO gateway; proxies FastAPI; **fallback supervisor**
- `StoreModule` (`@Global`) — in-memory adapter with the same shape as Postgres

**Fallback supervisor.** `AiService.chat()` tries FastAPI. On timeout it routes locally with the *same* intent policy. That is **graceful degradation**, not duplication for fun.

**Sound-bite.** “Nest is hexagonal-ish: the domain is independent of Angular and of Python. Adapters are HTTP, WebSocket, and later TypeORM/pgvector.”

---

## 4. Python + Pydantic

**Why Python at all.** The AI ecosystem (tokenizers, vector math, LangChain, eval libraries) is Python-first. Isolating it in `apps/ai-service` keeps Node free of torch-sized dependencies.

**Pydantic** is runtime schema validation. FastAPI uses it for request bodies (`ChatRequest`) and response models (`ChatResponse`). Interview contrast:

| TypeScript interfaces | Pydantic models |
| --- | --- |
| Compile-time only | Runtime parse + errors |
| Great for UI | Great for untrusted HTTP |

`GraphState` is a Pydantic model that plays the role of LangGraph state: every node reads/writes the same shape.

---

## 5. FastAPI

**What it is.** ASGI web framework. Automatic OpenAPI at `/docs`. Async-friendly, Pydantic-native.

**Endpoints in this service.**

| Method | Path | Role |
| --- | --- | --- |
| GET | `/health` | liveness + MCP tool names |
| POST | `/v1/chat` | supervisor invoke |
| POST | `/v1/knowledge/ingest` | embed + store |
| POST | `/v1/knowledge/search` | cosine top-k |
| GET | `/v1/mcp/tools` | list JSON-schema tools |
| POST | `/v1/eval` | lexical RAG metrics |

**Why not put agents inside Nest.** You can call OpenAI from Node. You cannot comfortably share the rest of the Python RAG/eval ecosystem. Two processes, one contract (`/v1/chat`).

---

## 6. LangChain vs LangGraph

**LangChain** is a library of *pieces*: prompts, chat models, retrievers, output parsers, tools.

**LangGraph** is an *orchestration runtime*: you define a graph of nodes and edges, persist state, branch, loop, and interrupt (human-in-the-loop).

**Supervisor pattern (this repo).**

```
START → supervisor (route) → task | rag | analytics → END
```

- **Supervisor** classifies intent (keywords now; LLM router when you add a key).
- **Task agent** performs side effects through tools (NestJS).
- **RAG agent** retrieves then answers from chunks.
- **Analytics agent** reads aggregates, does not invent numbers.

If `langgraph` is installed, `SupervisorGraph` compiles a real `StateGraph`. If not, it runs the same node functions. That is honest: the *architecture* is LangGraph even when the wheel is a Python function.

**Sound-bite.** “LangChain is Lego bricks. LangGraph is the instruction booklet that says which brick runs next and what state they share.”

---

## 7. Embeddings

An embedding is a **vector of floats** such that *nearby in space ≈ nearby in meaning* (for a trained model).

**Production.** `text-embedding-3-small` (1536-d) or `sentence-transformers`. Stored in `vector(1536)`.

**This prototype.** A **hashing trick**: tokenize, hash each token into 64 buckets with a random sign, L2-normalize. Properties:

- deterministic (tests, no API key)
- shared tokens increase cosine similarity
- **not** synonym-aware — that is what a neural embedding buys you

NestJS (`apps/api/src/app/store/embeddings.ts`) and Python (`apps/ai-service/app/embeddings.py`) use the **same algorithm** so either process can search the same conceptual index.

**Cosine similarity.** `dot(a,b) / (||a|| ||b||)` — angle, not magnitude. After L2-normalization, cosine equals a dot product.

---

## 8. RAG (Retrieval-Augmented Generation)

**Problem.** A raw LLM will hallucinate your internal project names.

**Pattern.**

1. **Ingest:** split docs into chunks → embed → store (pgvector).
2. **Retrieve:** embed the question → top-k nearest chunks.
3. **Generate:** prompt = question + chunks; answer grounded in context.
4. **Evaluate:** was the answer faithful to those chunks?

This repo does 1–2 and a lexical 4. Generation is extractive (returns the top chunk) until you plug in an LLM.

**Chunking (what to say next).** 200–500 tokens, overlap 10–20%, keep metadata (`projectId`, `source`) for filters.

---

## 9. Tool calling

**Idea.** The model does not “know” how to create a Jira ticket. It *emits a structured call* `{ tool: "create_task", args: {...} }`. Your runtime executes it and feeds the result back.

That is how the **task agent** talks to NestJS. Python is not allowed to INSERT into `tasks` itself.

**Loop.** think → call tool → observe → think again. LangGraph nodes make that loop explicit.

---

## 10. Agents

An agent is an LLM (or a policy) **plus tools plus a stopping condition**.

| Agent | Tools | Stop when |
| --- | --- | --- |
| Task | `create_task` | NestJS returns the row |
| RAG | `search_knowledge` | top-k is in state |
| Analytics | `workspace_analytics` | JSON stats are in state |

**Supervisor vs swarm.** Supervisor = one router. Swarm = agents talk to each other. Start with supervisor; it is easier to debug and to explain.

---

## 11. MCP (Model Context Protocol)

MCP is a **standard** for exposing tools/resources to models (think “LSP for tools”). A server lists tools with JSON Schema; a client (ChatGPT, Cursor, your agent runtime) calls them.

This repo’s `MCPRegistry` is the same *contract* without a separate MCP process:

- `name`
- `description`
- `input_schema`
- handler

`GET /v1/mcp/tools` is what you would dump into an MCP `tools/list` response.

**Sound-bite.** “MCP is function calling with a portable schema. Our registry is the in-process version; a real MCP server would wrap NestJS.”

---

## 12. AI evaluation

You cannot ship RAG on vibes.

| Metric | Question it asks |
| --- | --- |
| Faithfulness | Did the answer stay inside retrieved context? |
| Context precision / recall | Did we retrieve the right chunks? |
| Answer relevance | Did we actually address the question? |

Production: **RAGAS**, TruLens, or LLM-as-judge. This repo: Jaccard overlap of tokens — cheap, deterministic, good enough to show the *pipeline*. `POST /v1/eval`.

---

## 13. PostgreSQL

Relational store for entities with **foreign keys** (`tasks.project_id → projects.id`). That is ACID OLTP. Use it for anything you would put on a dashboard.

Analytics agent *should* eventually run SQL (`GROUP BY status`). Today it hits Nest’s aggregate endpoint so we do not require a live database.

---

## 14. pgvector

Postgres extension: a `vector(n)` column type + distance operators.

```sql
CREATE EXTENSION vector;
-- cosine distance
ORDER BY embedding <=> $query_vector
LIMIT 4;
```

**Indexes.** IVFFlat (lists of centroids) or HNSW (graph). IVFFlat needs some rows before it is useful; HNSW is the usual production default.

**Why not a dedicated vector DB (Pinecone, etc.)?** For this product size, **one operational database** wins. Split later if recall/QPS demand it.

`infra/postgres/init.sql` is the production-shaped schema. The running prototype uses an in-memory `VectorStore` / `MemoryStore` with the same fields so interviews still work on a laptop.

---

## 15. Suggested interview walkthrough (5 minutes)

1. Draw the diagram from the README.
2. Open Angular dashboard — “this is the client.”
3. Create a task — “NestJS is the source of truth; watch `POST /api/tasks`.”
4. Ingest a paragraph — “embed + store.”
5. AI console: *explain pgvector* → RAG route + scores.
6. AI console: *create task: …* → task agent tool call.
7. AI console: *how many tasks* → analytics.
8. Mention: FastAPI down → Nest fallback; Docker → real pgvector; API key → swap hashing trick for OpenAI embeddings + LLM generate.

---

## 16. What you would add next (shows seniority)

- JWT auth + RBAC on Nest modules
- TypeORM/Prisma adapter behind `MemoryStore`
- Real chunking + OpenAI/Ollama embeddings
- Token streaming over the existing Socket.IO gateway
- RAGAS eval job in CI
- Human-in-the-loop LangGraph interrupt before `create_task`
- OpenTelemetry traces across Angular → Nest → FastAPI
