import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, KnowledgeDoc, Project } from '../services/api.service';

@Component({
  selector: 'df-knowledge',
  imports: [FormsModule],
  template: `
    <header class="page-head">
      <div>
        <h1>Knowledge / RAG</h1>
        <p>Documents are chunked, embedded, and retrieved with cosine similarity.</p>
      </div>
    </header>

    <form class="stack" (ngSubmit)="ingest()">
      <select [(ngModel)]="projectId" name="projectId">
        @for (project of projects(); track project.id) {
          <option [value]="project.id">{{ project.name }}</option>
        }
      </select>
      <input [(ngModel)]="title" name="title" placeholder="Title" />
      <textarea [(ngModel)]="content" name="content" rows="4" placeholder="Paste architecture notes..."></textarea>
      <button type="submit">Ingest + embed</button>
    </form>

    <form class="form-row" (ngSubmit)="search()">
      <input [(ngModel)]="query" name="query" placeholder="Search embeddings" />
      <button type="submit">Retrieve</button>
    </form>

    @if (hits().length) {
      <section class="panel">
        <h2>Retrieval hits</h2>
        @for (hit of hits(); track hit.id) {
          <p><b>{{ hit.title }}</b> · score {{ hit.score }}<br />{{ hit.content }}</p>
        }
      </section>
    }

    <div class="grid">
      @for (doc of docs(); track doc.id) {
        <article class="panel">
          <h2>{{ doc.title }}</h2>
          <p>{{ doc.content }}</p>
          <small>{{ doc.source }} · dim {{ doc.embeddingDim }}</small>
        </article>
      }
    </div>
  `,
})
export class KnowledgePage {
  private readonly api = inject(ApiService);
  protected readonly docs = signal<KnowledgeDoc[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly hits = signal<Array<{ id: string; title: string; score: number; content: string }>>([]);
  protected projectId = '';
  protected title = '';
  protected content = '';
  protected query = 'How does the LangGraph supervisor route agents?';

  constructor() {
    this.api.projects().subscribe((projects) => {
      this.projects.set(projects);
      this.projectId = projects[0]?.id ?? '';
    });
    this.reload();
  }

  ingest() {
    this.api
      .ingest({ projectId: this.projectId, title: this.title, content: this.content })
      .subscribe(() => {
        this.title = '';
        this.content = '';
        this.reload();
      });
  }

  search() {
    this.api.search(this.query).subscribe((hits) =>
      this.hits.set(hits as Array<{ id: string; title: string; score: number; content: string }>)
    );
  }

  private reload() {
    this.api.knowledge().subscribe((docs) => this.docs.set(docs));
  }
}
