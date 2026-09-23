import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService, KnowledgeDoc, Project } from '../../services/api.service';

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
  templateUrl: './knowledge.html',
  styleUrl: './knowledge.css',
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
