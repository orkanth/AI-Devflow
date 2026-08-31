# LangChain, LangGraph, and RAG (read this first)

You do **not** need to learn the whole LangChain ecosystem. This repo uses three ideas.

## 1. RAG (Retrieval-Augmented Generation)

A raw GPT call will invent project names. RAG forces it to **look up** your docs first.

```
ingest  → split text → embed each chunk → store vectors
ask     → embed the question → nearest chunks → prompt(question + chunks) → GPT
```

In this repo:

| Step | Code |
| --- | --- |
| Split | `RecursiveCharacterTextSplitter` in `apps/ai-service/app/rag/pipeline.py` |
| Embed + store | hashing-trick vectors in `apps/ai-service/app/vectorstore.py` (same math as NestJS) |
| Retrieve | `retrieve_documents()` → LangChain `Document` objects |
| Generate | LCEL chain: `ChatPromptTemplate \| ChatOpenAI \| StrOutputParser` |

**LCEL** means you pipe Runnables with `|`. It is ordinary Python objects, not a new language.

When `OPENAI_API_KEY` is missing, retrieve still runs; generate is skipped and the top chunk is returned (extractive). Tests stay deterministic.

## 2. LangChain (the pieces)

LangChain is a toolkit. We use four pieces:

- **`ChatOpenAI`** — GPT wrapper (`apps/ai-service/app/llm.py`). No raw `httpx` to OpenAI.
- **`ChatPromptTemplate`** — the RAG prompt with `{question}` and `{context}`.
- **`StrOutputParser` / JSON mode** — turn the model output into a string or a dict.
- **`bind_tools`** — the task agent lets GPT pick a NestJS tool (`apps/ai-service/app/tools/langchain_tools.py`).

LangChain does **not** own routing. That is LangGraph.

## 3. LangGraph (the traffic cop)

LangGraph is a **state machine**:

```
START → supervisor → task | rag | analytics → END
```

- Shared **state** is `GraphState` (message, route, answer, contexts, trace).
- Each **node** is a Python function that reads/writes state.
- **Edges** say what runs next. The supervisor edge is *conditional*: it looks at `state["route"]`.

File: `apps/ai-service/app/graph/supervisor.py`.

```
supervisor node:  classify with GPT (LangChain) or regex
rag node:         LangChain RAG pipeline
task node:        LangChain tool calling → HTTP to NestJS
analytics node:   GET /api/ai/analytics (no guessing)
```

**Interview sound-bite.** “LangChain is Lego. LangGraph is the instruction booklet. RAG is the retrieve-then-generate pattern we put in the rag node.”

## 4. Turn GPT on

```bash
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o-mini   # optional
npx nx serve ai-service           # must restart
```

Then `GET http://localhost:8000/health` should show `"llm": { "enabled": true, ... }` and `"langgraph": true`.

Ask in the AI console: `explain pgvector cosine search`. You should see retrieved contexts plus a GPT answer, `engine=langgraph`.

## 5. What we deliberately did not do

- We did **not** put OpenAI embeddings in the same index as the hashing trick (different dimensions). Retrieval stays local so NestJS and Python stay compatible.
- We did **not** let Python INSERT tasks. Tools call NestJS.
- We did **not** require GPT for tests. pytest never calls the network.
