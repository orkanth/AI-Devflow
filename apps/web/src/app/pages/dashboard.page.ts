import { Component, inject, signal } from '@angular/core';
import { ApiService, User, WorkspaceStats } from '../services/api.service';

@Component({
  selector: 'df-dashboard',
  template: `
    <header class="page-head">
      <div>
        <h1>DevFlow control plane</h1>
        <p>Angular UI talking to the NestJS system of record.</p>
      </div>
    </header>

    @if (error()) {
      <div class="banner">
        API is not reachable yet. Start NestJS with <code>npx nx serve api</code>.
      </div>
    }

    <section class="cards">
      @for (card of cards(); track card.label) {
        <article>
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
        </article>
      }
    </section>

    <section class="panel">
      <h2>Team</h2>
      <ul>
        @for (user of users(); track user.id) {
          <li>
            <b>{{ user.name }}</b>
            <span>{{ user.role }} · {{ user.email }}</span>
          </li>
        }
      </ul>
    </section>
  `,
})
export class DashboardPage {
  private readonly api = inject(ApiService);
  protected readonly users = signal<User[]>([]);
  protected readonly cards = signal<Array<{ label: string; value: number }>>([]);
  protected readonly error = signal(false);

  constructor() {
    this.api.health().subscribe({
      next: (payload) => this.setStats(payload.stats),
      error: () => this.error.set(true),
    });
    this.api.users().subscribe({
      next: (users) => this.users.set(users),
      error: () => this.error.set(true),
    });
  }

  private setStats(stats: WorkspaceStats) {
    this.cards.set([
      { label: 'Users', value: stats.users },
      { label: 'Projects', value: stats.projects },
      { label: 'Tasks', value: stats.tasks },
      { label: 'Knowledge chunks', value: stats.knowledgeChunks },
    ]);
  }
}
