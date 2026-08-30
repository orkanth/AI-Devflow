import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService, KnowledgeDoc, Project } from '../services/api.service';

@Component({
  selector: 'df-knowledge',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-title">Knowledge / RAG</h1>
        <p class="page-subtitle">Documents are chunked, embedded, and retrieved with cosine similarity.</p>
      </div>
    </header>

    <mat-card class="form-card">
      <mat-card-content>
        <form class="stack" (ngSubmit)="ingest()">
          <mat-form-field appearance="outline">
            <mat-label>Project</mat-label>
            <mat-select [(ngModel)]="projectId" name="projectId">
              @for (project of projects(); track project.id) {
                <mat-option [value]="project.id">{{ project.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Title</mat-label>
            <input matInput [(ngModel)]="title" name="title" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Content</mat-label>
            <textarea matInput rows="4" [(ngModel)]="content" name="content"></textarea>
          </mat-form-field>
          <button mat-flat-button color="primary" type="submit">Ingest + embed</button>
        </form>
      </mat-card-content>
    </mat-card>

    <mat-card class="form-card">
      <mat-card-content>
        <form class="page-toolbar" (ngSubmit)="search()">
          <mat-form-field appearance="outline" class="grow">
            <mat-label>Search embeddings</mat-label>
            <input matInput [(ngModel)]="query" name="query" />
          </mat-form-field>
          <button mat-stroked-button color="primary" type="submit">Retrieve</button>
        </form>
      </mat-card-content>
    </mat-card>

    @if (hits().length) {
      <mat-card class="form-card">
        <mat-card-header>
          <mat-card-title>Retrieval hits</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @for (hit of hits(); track hit.id) {
            <p>
              <strong>{{ hit.title }}</strong> · score {{ hit.score }}<br />
              {{ hit.content }}
            </p>
          }
        </mat-card-content>
      </mat-card>
    }

    <div class="card-grid">
      @for (doc of docs(); track doc.id) {
        <mat-card>
          <mat-card-header>
            <mat-card-title>{{ doc.title }}</mat-card-title>
            <mat-card-subtitle>{{ doc.source }} · dim {{ doc.embeddingDim }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p>{{ doc.content }}</p>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: `
    .form-card,
    mat-card {
      border: 1px solid #e2e8f0;
      box-shadow: none;
    }

    .form-card {
      margin-bottom: 16px;
    }

    .stack {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .grow {
      flex: 1;
    }

    .page-toolbar button {
      height: 56px;
      margin-top: 4px;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
  `,
})
export class KnowledgePage {
  private readonly api = inject(ApiService);
  protected readonly docs = signal<KnowledgeDoc[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly hits = signal<
    Array<{ id: string; title: string; score: number; content: string }>
  >([]);
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
      .ingest({
        projectId: this.projectId,
        title: this.title,
        content: this.content,
      })
      .subscribe(() => {
        this.title = '';
        this.content = '';
        this.reload();
      });
  }

  search() {
    this.api.search(this.query).subscribe((hits) =>
      this.hits.set(
        hits as Array<{ id: string; title: string; score: number; content: string }>
      )
    );
  }

  private reload() {
    this.api.knowledge().subscribe((docs) => this.docs.set(docs));
  }
}
