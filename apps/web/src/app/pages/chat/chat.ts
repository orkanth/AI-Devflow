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
import { AiStatus, ApiService, ChatResult, Project } from '../../services/api.service';

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
  templateUrl: './chat.html',
  styleUrl: './chat.css',
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
