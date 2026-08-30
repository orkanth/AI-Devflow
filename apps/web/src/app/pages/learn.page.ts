import { Component } from '@angular/core';

@Component({
  selector: 'df-learn',
  template: `
    <header class="page-head">
      <div>
        <h1>Interview notes</h1>
        <p>Talk through this architecture out loud. Full write-up is in docs/INTERVIEW_GUIDE.md.</p>
      </div>
    </header>

    <div class="diagram">
      <pre>{{ diagram }}</pre>
    </div>

    <section class="grid">
      @for (card of cards; track card.title) {
        <article class="panel">
          <h2>{{ card.title }}</h2>
          <p>{{ card.body }}</p>
        </article>
      }
    </section>
  `,
})
export class LearnPage {
  protected readonly diagram = `DevFlow AI
    │
    ▼
Angular  --REST/WS-->  NestJS (Users / Projects / Tasks)
                         │
                    PostgreSQL + pgvector
                         ▲
FastAPI  --LangGraph supervisor--  Task | RAG | Analytics
                         │
                   Tool calling → NestJS`;

  protected readonly cards = [
    {
      title: 'Why Nx?',
      body: 'One repo, many apps, shared commands. nx serve web / api / ai-service. Affected builds and a single CI graph.',
    },
    {
      title: 'Why NestJS owns writes?',
      body: 'Authorization, validation, and transactions belong in the business API. Agents call tools; they do not become a second database.',
    },
    {
      title: 'Why FastAPI for agents?',
      body: 'Python is the ecosystem for LangChain, LangGraph, embeddings, and eval. Keep that isolated so Node stays the product API.',
    },
    {
      title: 'RAG in one sentence',
      body: 'Embed the question, retrieve top-k chunks from a vector index, then answer only from that context. Evaluate faithfulness.',
    },
    {
      title: 'Supervisor vs workers',
      body: 'The supervisor classifies intent. Workers specialize: task (tools), RAG (vectors), analytics (SQL aggregates).',
    },
    {
      title: 'MCP',
      body: 'Tools are described with JSON Schema. The model chooses a tool instead of free-form side effects. Same idea as function calling.',
    },
  ];
}
