import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { ApiService, Task, User, WorkspaceStats } from '../services/api.service';
import { SessionService } from '../services/session.service';
import { DashboardStatCardComponent } from './dashboard-stat-card.component';

@Component({
  selector: 'df-dashboard',
  imports: [
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    RouterLink,
    DashboardStatCardComponent,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">
          Welcome back{{ session.currentUser() ? ', ' + session.currentUser()!.name : '' }}.
        </p>
      </div>
    </header>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" />
    }

    @if (error()) {
      <mat-card class="alert-card">
        <mat-card-content>
          API is not reachable. Start NestJS with <code>npx nx serve api</code>.
        </mat-card-content>
      </mat-card>
    }

    <section class="dashboard__stats">
      @for (card of cards(); track card.label) {
        <df-dashboard-stat-card
          [label]="card.label"
          [value]="card.value"
          [icon]="card.icon"
          [color]="card.color"
        />
      }
    </section>

    <mat-card class="team-card">
      <mat-card-header>
        <mat-icon mat-card-avatar>group</mat-icon>
        <mat-card-title>Team</mat-card-title>
        <mat-card-subtitle>Users from NestJS</mat-card-subtitle>
      </mat-card-header>
      <mat-nav-list>
        @for (user of users(); track user.id) {
          <a mat-list-item routerLink="/users">
            <mat-icon matListItemIcon>account_circle</mat-icon>
            <span matListItemTitle>{{ user.name }}</span>
            <span matListItemLine>{{ user.role }} · {{ user.email }}</span>
          </a>
        }
      </mat-nav-list>
    </mat-card>
  `,
  styles: `
    .dashboard__stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin: 16px 0 24px;
    }

    .alert-card {
      margin-bottom: 16px;
      border: 1px solid #f59e0b;
    }

    .team-card {
      border: 1px solid #e2e8f0;
      box-shadow: none;
    }

    @media (max-width: 1024px) {
      .dashboard__stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 600px) {
      .dashboard__stats {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);
  protected readonly users = signal<User[]>([]);
  protected readonly cards = signal<
    Array<{
      label: string;
      value: number;
      icon: string;
      color: 'blue' | 'amber' | 'green' | 'slate';
    }>
  >([]);
  protected readonly error = signal(false);
  protected readonly loading = signal(true);

  constructor() {
    this.api.users().subscribe({
      next: (users) => {
        this.users.set(users);
        this.session.users.set(users);
        const current = this.session.currentUserId();
        if (!current || !users.some((user) => user.id === current)) {
          this.session.setUser(users[0]?.id ?? null);
        }
        this.api.health().subscribe({
          next: (payload) => {
            this.api.tasks().subscribe((tasks) => {
              this.setStats(payload.stats, tasks);
              this.loading.set(false);
            });
          },
          error: () => {
            this.error.set(true);
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private setStats(stats: WorkspaceStats, tasks: Task[]) {
    const me = this.session.currentUser()?.id;
    const mine = tasks.filter((task) => task.assigneeId === me);
    this.cards.set([
      {
        label: 'My to do',
        value: mine.filter((task) => task.status === 'todo').length,
        icon: 'radio_button_unchecked',
        color: 'blue',
      },
      {
        label: 'In progress',
        value: mine.filter((task) => task.status === 'in_progress').length,
        icon: 'pending',
        color: 'amber',
      },
      {
        label: 'Completed',
        value: mine.filter((task) => task.status === 'done').length,
        icon: 'check_circle',
        color: 'green',
      },
      {
        label: 'Active projects',
        value: stats.projects,
        icon: 'folder',
        color: 'slate',
      },
    ]);
  }
}
