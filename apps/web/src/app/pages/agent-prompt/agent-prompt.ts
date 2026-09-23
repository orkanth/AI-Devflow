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
  ChatResult,
  Project,
} from '../../services/api.service';

export interface ExamplePrompt {
  id: string;
  title: string;
  description: string;
  icon: string;
  prompt: string;
  kind: 'tdd' | 'generic';
}

export interface ProgressStep {
  id: string;
  label: string;
  detail: string;
  status: 'pending' | 'active' | 'done' | 'error' | 'skipped';
}

@Component({
  selector: 'df-agent-prompt',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './agent-prompt.html',
  styleUrl: './agent-prompt.css',
})
export class AgentPromptPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly projects = signal<Project[]>([]);
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly result = signal<ChatResult | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly steps = signal<ProgressStep[]>([]);
  protected readonly selectedExample = signal<string | null>(null);

  protected projectId = '';
  protected message = '';
  private progressTimer: ReturnType<typeof setInterval> | undefined;

  protected readonly examples: ExamplePrompt[] = [
    {
      id: 'create-task',
      title: 'Create task',
      description: 'Ask the agent to open a new ticket in the selected project.',
      icon: 'add_task',
      kind: 'generic',
      prompt: 'Create task "Write agent prompt notes"',
    },
    {
      id: 'update-task',
      title: 'Update task',
      description: 'Change status or priority of an existing task by title.',
      icon: 'edit_note',
      kind: 'generic',
      prompt:
        'Update task "Write agent prompt notes" to in_progress with high priority',
    },
    {
      id: 'create-project',
      title: 'Create project',
      description: 'Spin up a new workspace project from a single sentence.',
      icon: 'create_new_folder',
      kind: 'generic',
      prompt: 'Create project "Mobile app rollout"',
    },
    {
      id: 'tdd-tasks',
      title: 'Create tasks from TDD',
      description:
        'Read uploaded TDD documents for this project and create one task per file.',
      icon: 'playlist_add',
      kind: 'tdd',
      prompt: 'Create tasks from TDD documents for this project',
    },
  ];

  constructor() {
    this.destroyRef.onDestroy(() => this.clearProgressTimer());
  }

  ngOnInit() {
    this.api
      .projects()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((projects) => {
        this.projects.set(projects);
        if (!this.projectId && projects[0]) {
          this.projectId = projects[0].id;
        }
      });
    this.api
      .aiStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => this.aiStatus.set(status));
  }

  useExample(example: ExamplePrompt) {
    this.selectedExample.set(example.id);
    this.message = example.prompt;
  }

  send() {
    const text = this.message.trim();
    if (!text || this.busy()) {
      return;
    }
    const example = this.examples.find((item) => item.id === this.selectedExample());
    const kind =
      example?.kind === 'tdd' || /tdd/i.test(text) ? 'tdd' : 'generic';

    this.busy.set(true);
    this.error.set(null);
    this.result.set(null);
    this.steps.set(this.buildSteps(kind));
    this.activateNext();
    this.clearProgressTimer();
    this.progressTimer = setInterval(() => this.activateNext(), 850);

    this.api.chat(text, this.projectId || undefined).subscribe({
      next: (result) => {
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
      {
        id: 'route',
        label: 'Route intent',
        detail: 'Choosing create task, update task, create project, or TDD.',
        status: 'pending',
      },
    ];
    if (kind === 'tdd') {
      steps.push({
        id: 'tdd',
        label: 'Read TDD documents',
        detail: 'Listing uploaded TDD files for the selected project.',
        status: 'pending',
      });
    }
    steps.push(
      {
        id: 'tools',
        label: 'Call NestJS tools',
        detail: 'Creating or updating records through the API.',
        status: 'pending',
      },
      {
        id: 'done',
        label: 'Finish',
        detail: 'Collecting the agent answer and trace.',
        status: 'pending',
      }
    );
    return steps;
  }

  private activateNext() {
    const steps = [...this.steps()];
    const active = steps.findIndex((step) => step.status === 'active');
    const pending = steps.findIndex((step) => step.status === 'pending');
    if (pending === -1) {
      return;
    }
    // Keep the last step pending until the HTTP call returns.
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
    const usedTdd = tools.includes('list_knowledge') || tools.includes('create_tasks_from_tdd');
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
            detail: tools.length
              ? `Tools: ${tools.join(', ')}.`
              : step.detail,
          };
        }
        return { ...step, status: 'done' };
      })
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
          : step
      )
    );
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
