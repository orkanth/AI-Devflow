import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import {MatGridListModule} from '@angular/material/grid-list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { ApiService, Task, User, WorkspaceStats } from '../../services/api.service';
import { SessionService } from '../../services/session.service';  
import { DashboardStatCardComponent } from '../../components/dashboard-stat-card/dashboard-stat-card';

@Component({
  selector: 'df-dashboard',
 imports: [
    MatCardModule,
    MatIconModule,
    MatListModule, 
    MatGridListModule,
    MatProgressBarModule,
    RouterLink,
    DashboardStatCardComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
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
