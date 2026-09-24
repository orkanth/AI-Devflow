import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment/environment';

export interface Project {
  id: string;
  name: string;
}

export interface ChatResult {
  answer: string;
  route: string;
  source: string;
  llm?: boolean;
  model?: string | null;
  engine?: string;
  trace: Array<{
    agent: string;
    reason: string;
    toolCalls: Array<{ tool: string; args: unknown; result: unknown }>;
  }>;
  contexts?: Array<{ title: string; score: number; content: string }>;

  // --- Add User Management & Confirmation Flags ---
  status?: 'completed' | 'requires_action' | 'error';
  action_type?: 'missing_info' | 'confirmation' | 'none';
  missing_fields?: string[];
  requires_confirmation?: boolean;
}

export interface AiStatus {
  status: string;
  service?: string;
  llm?: { enabled: boolean; model: string | null; provider: string | null };
}

@Injectable({ providedIn: 'root' })
export class AiApiService {
  private readonly http = inject(HttpClient);
  
  // Point directly to Python FastAPI
  private readonly fastapiUrl =  environment.AI_SERVICE_URL || 'http://localhost:8000';
  private readonly nestjsUrl =  environment.API_SERVICE_URL || 'http://localhost:3333';

  aiStatus(): Observable<AiStatus> {
    return this.http.get<AiStatus>(`${this.fastapiUrl}/health`);
  }

 projects(): Observable<Project[]> { 
  return this.http.get<Project[]>(`${this.nestjsUrl}/api/projects`);
}

  chat(message: string, projectId?: string): Observable<ChatResult> {
    // Direct POST to FastAPI /v1/chat
    return this.http.post<ChatResult>(`${this.fastapiUrl}/v1/chat`, {
      message,
      project_id: projectId || null,
    });
  }
}