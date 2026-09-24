import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import {
  AiStatus,
  ApiService,
  Project,
} from '../../services/api.service';
import { 
  ChatResult, AiApiService } from '../../services/ai-api.service';
import { TitleCasePipe } from '@angular/common';

export interface ProgressStep {
  id: string;
  label: string;
  detail: string;
  status: 'pending' | 'active' | 'done' | 'error' | 'skipped';
}

@Component({
  selector: 'df-agent-prompt',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    TitleCasePipe,
    MatSelectModule,
  ],
  templateUrl: './agent-prompt.html',
  styleUrl: './agent-prompt.css',
})
export class AgentPromptPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly aiApi = inject(AiApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly projects = signal<Project[]>([]);
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly result = signal<ChatResult | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly steps = signal<ProgressStep[]>([]);

  // Remains empty by default since project selection is optional
  protected projectId = '';
  protected message = '';
  private progressTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearProgressTimer());
  }

  ngOnInit() {
    this.api
      .projects()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((projects) => {
        this.projects.set(projects);
        // Do NOT auto-select projects[0] so selection remains optional
      });

    this.api
      .aiStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => this.aiStatus.set(status));
  }

  send() {
    const text = this.message.trim();
    if (!text || this.busy()) {
      return;
    }

    const isTdd = /tdd|document|spec/i.test(text);

    this.busy.set(true);
    this.error.set(null);
    this.result.set(null);
    this.steps.set(this.buildSteps(isTdd ? 'tdd' : 'generic'));

    this.activateNext();
    this.clearProgressTimer();
    this.progressTimer = setInterval(() => this.activateNext(), 850);

    // Pass projectId if selected, otherwise pass undefined
    const selectedProjectId = this.projectId ? this.projectId : undefined;

    this.aiApi.chat(text, selectedProjectId).subscribe({
      next: (result) => {
        console.log('Agent prompt result:', result);
        this.clearProgressTimer();
        this.result.set(result);
        this.completeSteps(result);
        this.busy.set(false);
      },
      error: (err) => {
        this.clearProgressTimer();
        this.busy.set(false);
        this.error.set(err?.error?.message ?? 'Agent prompt failed.');
        this.failActiveStep();
      },
    });
  }

  private buildSteps(kind: 'tdd' | 'generic'): ProgressStep[] {
    const steps: ProgressStep[] = [
      {
        id: 'send',
        label: 'Submit prompt',
        detail: 'Sending your request to the supervisor.',
        status: 'pending',
      },
    ];

    steps.push({
      id: 'done',
      label: 'Finish',
      detail: 'Collecting the agent answer and trace.',
      status: 'pending',
    });

    return steps;
  }

  private activateNext() {
    const steps = [...this.steps()];
    const active = steps.findIndex((step) => step.status === 'active');
    const pending = steps.findIndex((step) => step.status === 'pending');

    if (pending === -1) {
      return;
    }

    if (pending === steps.length - 1 && this.busy()) {
      if (active >= 0 && active < steps.length - 1) {
        steps[active] = { ...steps[active], status: 'done' };
      }
      this.steps.set(steps);
      return;
    }

    if (active >= 0) {
      steps[active] = { ...steps[active], status: 'done' };
    }

    steps[pending] = { ...steps[pending], status: 'active' };
    this.steps.set(steps);
  }

  private completeSteps(result: ChatResult) {
    const tools = result.trace?.[0]?.toolCalls?.map((call) => call.tool) ?? [];
    const usedTdd =
      tools.includes('list_knowledge') ||
      tools.includes('create_tasks_from_tdd');

    this.steps.set(
      this.steps().map((step) => {
        if (step.id === 'tdd' && !usedTdd) {
          return {
            ...step,
            status: 'skipped',
            detail: 'TDD documents were not required for this prompt.',
          };
        }
        if (step.id === 'route') {
          return {
            ...step,
            status: 'done',
            detail: `Routed to ${result.route} via ${result.source}.`,
          };
        }
        if (step.id === 'tools') {
          return {
            ...step,
            status: 'done',
            detail: tools.length ? `Tools: ${tools.join(', ')}.` : step.detail,
          };
        }
        return { ...step, status: 'done' };
      }),
    );
  }

  private clearProgressTimer() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = undefined;
    }
  }

  private failActiveStep() {
    this.steps.set(
      this.steps().map((step) =>
        step.status === 'active' || step.status === 'pending'
          ? {
              ...step,
              status: step.status === 'active' ? 'error' : 'pending',
            }
          : step,
      ),
    );
  }

  addMissingField(field: string) {
    const current = this.message.trim();
    if (current) {
      this.message = `${current} and ${field.toLowerCase()} `;
    } else {
      this.message = `The ${field.toLowerCase()} is `;
    }
  }

  confirmAction(answer: 'Yes' | 'No') {
    this.message = answer;
    this.send();
  }

  protected stepIcon(status: ProgressStep['status']) {
    switch (status) {
      case 'done':
        return 'check_circle';
      case 'active':
        return 'hourglass_top';
      case 'error':
        return 'error';
      case 'skipped':
        return 'remove_circle_outline';
      default:
        return 'radio_button_unchecked';
    }
  }
}
