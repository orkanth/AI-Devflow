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
                    │ Business/API    │  Users · Projects · Tasks · TTD
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
| AI | FastAPI + LangChain RAG + LangGraph supervisor + GPT |
| Data | PostgreSQL + pgvector (in-memory adapter by default) |
| Monorepo | Nx 23 |

## Apps

| App | Path | Port | Responsibility |
| --- | --- | --- | --- |
| Angular UI | `apps/web` | 4200 | Dashboard, CRUD screens, AI console, interview notes |
| NestJS API | `apps/api` | 3333 | System of record for users, projects, tasks; AI proxy + WebSocket |
| FastAPI AI | `apps/ai-service` | 8000 | LangGraph supervisor, LangChain RAG, NestJS tools, eval |
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

# if it's getting issue
npx nx reset

Open http://localhost:4200

Optional database:

```bash
docker compose up -d
```

The prototype **does not require Docker or an OpenAI key**. Embeddings are a deterministic hashing trick (same algorithm in NestJS and Python). NestJS falls back to a local supervisor if FastAPI is down.

### Use GPT (optional)

Set an OpenAI-compatible key, then **restart FastAPI** (`npx nx serve ai-service`):

```bash
export OPENAI_API_KEY=sk-...
# optional
export OPENAI_MODEL=gpt-4o-mini
# export OPENAI_BASE_URL=https://api.openai.com/v1
```

Or copy `.env.example` to `.env` at the repo root (never commit the key). With a key:

- LangGraph **supervisor** classifies with LangChain `ChatOpenAI` (regex if the call fails)
- RAG **retrieves** hashing-trick chunks, then **generates** with LCEL (`prompt | ChatOpenAI | parser`)
- Task agent uses LangChain **`bind_tools`** against NestJS (regex intents if the call fails)

Health: `GET http://localhost:8000/health` → `llm.enabled` and `langgraph`. The AI console shows GPT vs fallback.

## Why this split (the 30-second interview answer)

- **Angular** renders the product and talks HTTP. It never owns business rules.
- **NestJS** is the **system of record**. Authorization, validation, and writes live here.
- **FastAPI + LangGraph** is the **reasoning plane**. Agents call tools; they do not store tasks themselves.
- **PostgreSQL** holds relational data. **pgvector** stores embeddings next to that data so RAG is not a second product database.
- **Nx** keeps TypeScript and Python apps in one graph: `nx test api`, `nx test ai-service`, `nx graph`.

## Learn the stack

Read [`docs/INTERVIEW_GUIDE.md`](docs/INTERVIEW_GUIDE.md) and [`docs/LANGCHAIN_LANGGRAPH.md`](docs/LANGCHAIN_LANGGRAPH.md) (LangChain vs LangGraph vs RAG, mapped to this repo’s files).

## Node note

Angular 22 wants Node `>= 22.22`. If `nx serve web` fails on an older 22.x, upgrade Node or use the NestJS/FastAPI APIs directly (`http://localhost:3333/api`, `http://localhost:8000/docs`).


## create component in FE
npx nx g @nx/angular:component apps/web/src/app/pages/users/users --skip-tests


apps/ai-service/
├── app/
│   ├── eval/                      # KEEP: For offline LLM benchmark evaluations / tests
│   │   ├── __init__.py
│   │   └── evaluator.py
│   ├── graph/                     # CORE: Agent orchestration tier
│   │   ├── agents/                # Domain agents (task_agent.py, user_agent.py, etc.)
│   │   ├── supervisor.py          # Intent router (decides whether to call CRUD, TDD RAG, or Direct Tool)
│   │   └── __init__.py
│   ├── rag/                       # CORE: TDD document ingestion & extraction
│   │   ├── pipeline.py            # Reads chunks, embeds them, feeds context to GPT
│   │   └── __init__.py
│   ├── tools/                     # CORE: MCP tool layer
│   │   ├── mcp_registry.py        # Dispatches tool calls via MCP client protocol
│   │   ├── nestjs_tools.py        # REST connectors to your NestJS backend (localhost:3000)
│   │   ├── langchain_tools.py     # Wraps MCP/REST tools into LangChain/LangGraph callable tools
│   │   └── __init__.py
│   ├── embeddings.py              # Text embedding generation (OpenAI text-embedding-3-small)
│   ├── llm.py                     # OpenAI / Chat completions client setup
│   ├── main.py                    # ENTRY POINT: FastAPI routes (/v1/chat, /health)
│   ├── schemas.py                 # Pydantic schemas (ChatRequest, ChatResponse, AgentTrace)
│   └── vectorstore.py             # Vector store connector (PostgreSQL pgvector)
├── project.json                   # Nx / Monorepo project config
└── requirements.txt               # Dependencies



app/main.py: FastAPI application setup, CORS middleware, and API endpoints (invocations & SSE streaming).

app/schemas.py: Pydantic input/output schemas for the HTTP layer.

app/llm.py & app/embeddings.py: Shared model factories (e.g., ChatOpenAI/Anthropic and embedding models).

app/vectorstore.py: pgvector connection via LangChain's vector store or SQLAlchemy async engine.

app/rag/pipeline.py: Retrieval chains, context formatting, and similarity search logic.

app/tools/nestjs_tools.py: HTTP client calls into your NestJS API (/tasks, /projects, etc.).

app/tools/langchain_tools.py: Wrappers turning your NestJS client and RAG retrieval functions into @tool definitions.

app/graph/agents/: Individual agent implementations (task_agent.py, rag_agent.py, analytics_agent.py).

app/graph/supervisor.py: LangGraph State definition, supervisor decision chain, and the compiled StateGraph.