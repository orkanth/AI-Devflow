import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { ApiService, ChatResult, Project } from '../services/api.service';

@Component({
  selector: 'df-chat',
  imports: [FormsModule, JsonPipe],
  template: `
    <header class="page-head">
      <div>
        <h1>AI console</h1>
        <p>NestJS proxies to FastAPI. If Python is down, NestJS runs the same supervisor locally.</p>
      </div>
    </header>

    <div class="prompts">
      @for (prompt of prompts; track prompt) {
        <button type="button" class="ghost" (click)="message = prompt">{{ prompt }}</button>
      }
    </div>

    <form class="stack" (ngSubmit)="send()">
      <select [(ngModel)]="projectId" name="projectId">
        <option value="">All projects</option>
        @for (project of projects(); track project.id) {
          <option [value]="project.id">{{ project.name }}</option>
        }
      </select>
      <textarea [(ngModel)]="message" name="message" rows="3"></textarea>
      <button type="submit" [disabled]="busy()">Run supervisor</button>
    </form>

    @if (result(); as chat) {
      <article class="panel">
        <p class="meta">route={{ chat.route }} · source={{ chat.source }}</p>
        <p>{{ chat.answer }}</p>
      </article>
      <article class="panel">
        <h2>Agent trace</h2>
        <pre>{{ chat.trace | json }}</pre>
      </article>
    }
  `,
})
export class ChatPage {
  private readonly api = inject(ApiService);
  protected readonly projects = signal<Project[]>([]);
  protected readonly result = signal<ChatResult | null>(null);
  protected readonly busy = signal(false);
  protected projectId = '';
  protected message = 'explain pgvector cosine search';
  protected readonly prompts = [
    'explain pgvector cosine search',
    'create task: Write LangGraph interview notes',
    'how many tasks are open?',
  ];

  constructor() {
    this.api.projects().subscribe((projects) => this.projects.set(projects));
  }

  send() {
    this.busy.set(true);
    this.api.chat(this.message, this.projectId || undefined).subscribe({
      next: (result) => {
        this.result.set(result);
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
  }
}
