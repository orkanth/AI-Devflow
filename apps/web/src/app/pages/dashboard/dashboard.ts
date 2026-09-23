import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DashboardMyTaskChart,
  MyTasksChartStats,
} from '../../components/dashboard-myt-task-chart/dashboard-my-task-chart';
import { DashboardStatCardComponent } from '../../components/dashboard-stat-card/dashboard-stat-card';
import { ApiService, Project, Task, User, WorkspaceStats } from '../../services/api.service';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'df-dashboard',
  imports: [
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    RouterLink,
    DashboardStatCardComponent,
    DashboardMyTaskChart,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardPage {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);
  protected readonly users = signal<User[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly chartProjectId = signal('');
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

  protected readonly chartTaskStats = computed<MyTasksChartStats>(() => {
    const projectId = this.chartProjectId();
    const scoped = this.tasks().filter((task) => !projectId || task.projectId === projectId);
    const todo = scoped.filter((task) => task.status === 'todo').length;
    const in_progress = scoped.filter((task) => task.status === 'in_progress').length;
    const done = scoped.filter((task) => task.status === 'done').length;
    const blocked = scoped.filter((task) => task.status === 'blocked').length;
    return { todo, in_progress, done, blocked, total: scoped.length };
  });

  constructor() {
    this.api.users().subscribe({
      next: (users) => {
        this.users.set(users);
        this.session.users.set(users);
        const current = this.session.currentUserId();
        if (!current || !users.some((user) => user.id === current)) {
          this.session.setUser(users[0]?.id ?? null);
        }
        forkJoin({
          health: this.api.health(),
          tasks: this.api.tasks(),
          projects: this.api.projects(),
        }).subscribe({
          next: ({ health, tasks, projects }) => {
            this.tasks.set(tasks);
            this.projects.set(projects);
            this.setStats(health.stats, tasks);
            this.loading.set(false);
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
