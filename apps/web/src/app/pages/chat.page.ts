import { JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { AiStatus, ApiService, ChatResult, Project } from '../services/api.service';

@Component({
  selector: 'df-chat',
  imports: [
    FormsModule,
    JsonPipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-title">AI console</h1>
        <p class="page-subtitle">
          @if (aiStatus()?.llm?.enabled) {
            GPT is on ({{ aiStatus()?.llm?.model }}). Supervisor routing, RAG answers, and task plans use OpenAI; regex still runs if a call fails.
          } @else {
            GPT is off — set OPENAI_API_KEY and restart FastAPI. Regex routing and extractive RAG still work.
          }
        </p>
      </div>
    </header>

    <mat-chip-set class="prompts">
      @for (prompt of prompts; track prompt) {
        <mat-chip (click)="message = prompt">{{ prompt }}</mat-chip>
      }
    </mat-chip-set>

    <mat-card class="form-card">
      <mat-card-content>
        <form class="stack" (ngSubmit)="send()">
          <mat-form-field appearance="outline">
            <mat-label>Project</mat-label>
            <mat-select [(ngModel)]="projectId" name="projectId">
              <mat-option value="">All projects</mat-option>
              @for (project of projects(); track project.id) {
                <mat-option [value]="project.id">{{ project.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Message</mat-label>
            <textarea matInput rows="3" [(ngModel)]="message" name="message"></textarea>
          </mat-form-field>
          <button mat-flat-button color="primary" type="submit" [disabled]="busy()">
            Run supervisor
          </button>
        </form>
      </mat-card-content>
    </mat-card>

    @if (busy()) {
      <mat-progress-bar mode="indeterminate" />
    }

    @if (result(); as chat) {
      <mat-card class="form-card">
        <mat-card-header>
          <mat-card-title>Answer</mat-card-title>
          <mat-card-subtitle>
            route={{ chat.route }} · source={{ chat.source }} ·
            {{ chat.llm ? 'GPT ' + (chat.model || '') : 'no GPT (fallback)' }}
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>{{ chat.answer }}</p>
        </mat-card-content>
      </mat-card>
      <mat-card>
        <mat-card-header>
          <mat-card-title>Agent trace</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <pre>{{ chat.trace | json }}</pre>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    .prompts {
      margin-bottom: 16px;
    }

    .form-card,
    mat-card {
      border: 1px solid #e2e8f0;
      box-shadow: none;
      margin-bottom: 16px;
    }

    .stack {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    pre {
      white-space: pre-wrap;
      font-size: 0.8125rem;
      margin: 0;
    }
  `,
})
export class ChatPage {
  private readonly api = inject(ApiService);
  protected readonly projects = signal<Project[]>([]);
  protected readonly result = signal<ChatResult | null>(null);
  protected readonly busy = signal(false);
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected projectId = '';
  protected message = 'explain pgvector cosine search';
  protected readonly prompts = [
    'explain pgvector cosine search',
    'create task: Write LangGraph interview notes',
    'assign task "Wire FastAPI LangGraph supervisor" to Grace Hopper',
    'delete task "Blocked: production embedding provider"',
    'how many tasks are open?',
  ];

  constructor() {
    this.api.projects().subscribe((projects) => this.projects.set(projects));
    this.api.aiStatus().subscribe((status) => this.aiStatus.set(status));
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
