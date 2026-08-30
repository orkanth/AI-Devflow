import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService, User, WorkspaceStats } from '../services/api.service';
import { DashboardStatCardComponent } from './dashboard-stat-card.component';

@Component({
  selector: 'df-dashboard',
  imports: [
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    DashboardStatCardComponent,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Welcome back — Angular talking to the NestJS system of record.</p>
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
          <a mat-list-item>
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
    this.api.health().subscribe({
      next: (payload) => {
        this.setStats(payload.stats);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
    this.api.users().subscribe({
      next: (users) => this.users.set(users),
      error: () => this.error.set(true),
    });
  }

  private setStats(stats: WorkspaceStats) {
    this.cards.set([
      {
        label: 'Users',
        value: stats.users,
        icon: 'group',
        color: 'blue',
      },
      {
        label: 'Projects',
        value: stats.projects,
        icon: 'folder',
        color: 'slate',
      },
      {
        label: 'Tasks',
        value: stats.tasks,
        icon: 'assignment',
        color: 'amber',
      },
      {
        label: 'Knowledge chunks',
        value: stats.knowledgeChunks,
        icon: 'auto_stories',
        color: 'green',
      },
    ]);
  }
}
