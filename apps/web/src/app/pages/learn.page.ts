import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'df-learn',
  imports: [MatCardModule],
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-title">Interview notes</h1>
        <p class="page-subtitle">
          Talk through this architecture out loud. Full write-up is in docs/INTERVIEW_GUIDE.md.
        </p>
      </div>
    </header>

    <mat-card class="diagram">
      <mat-card-content>
        <pre>{{ diagram }}</pre>
      </mat-card-content>
    </mat-card>

    <section class="card-grid">
      @for (card of cards; track card.title) {
        <mat-card>
          <mat-card-header>
            <mat-card-title>{{ card.title }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p>{{ card.body }}</p>
          </mat-card-content>
        </mat-card>
      }
    </section>
  `,
  styles: `
    .diagram {
      background: #0f172a;
      color: #e2e8f0;
      margin-bottom: 16px;
      box-shadow: none;
    }

    .diagram pre {
      margin: 0;
      white-space: pre-wrap;
      font-size: 0.85rem;
    }

    mat-card {
      border: 1px solid #e2e8f0;
      box-shadow: none;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
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
      body: 'The supervisor classifies intent (GPT if OPENAI_API_KEY is set, else regex). Workers specialize: task (tools), RAG (vectors), analytics (SQL aggregates).',
    },
    {
      title: 'MCP',
      body: 'Tools are described with JSON Schema. The model chooses a tool instead of free-form side effects. Same idea as function calling.',
    },
  ];
}
