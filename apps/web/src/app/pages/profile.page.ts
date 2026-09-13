import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { UserFormDialogComponent } from '../dialogs/user-form-dialog.component';
import { ApiService, Task } from '../services/api.service';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'df-profile',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-title">Profile</h1>
        <p class="page-subtitle">Your account details and assigned work</p>
      </div>
      @if (user(); as profile) {
        <button mat-stroked-button type="button" (click)="edit(profile)">Edit profile</button>
      }
    </header>

    @if (user(); as profile) {
      <div class="grid">
        <mat-card>
          <div class="hero">
            <div class="avatar">{{ initial() }}</div>
            <div>
              <h2>{{ profile.name }}</h2>
              <p>{{ profile.email }}</p>
              <mat-chip>{{ profile.role }}</mat-chip>
            </div>
          </div>
        </mat-card>
        <mat-card>
          <mat-card-header>
            <mat-card-title>Account details</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-list>
              <mat-list-item>
                <mat-icon matListItemIcon>badge</mat-icon>
                <span matListItemTitle>Full name</span>
                <span matListItemLine>{{ profile.name }}</span>
              </mat-list-item>
              <mat-divider />
              <mat-list-item>
                <mat-icon matListItemIcon>mail</mat-icon>
                <span matListItemTitle>Email</span>
                <span matListItemLine>{{ profile.email }}</span>
              </mat-list-item>
              <mat-divider />
              <mat-list-item>
                <mat-icon matListItemIcon>admin_panel_settings</mat-icon>
                <span matListItemTitle>Role</span>
                <span matListItemLine>{{ profile.role }}</span>
              </mat-list-item>
            </mat-list>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-header>
            <mat-card-title>My task summary</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="stats">
              <div><strong>{{ stats().total }}</strong><span>Total</span></div>
              <div><strong>{{ stats().todo }}</strong><span>To do</span></div>
              <div><strong>{{ stats().in_progress }}</strong><span>In progress</span></div>
              <div><strong>{{ stats().done }}</strong><span>Done</span></div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    }
  `,
  styles: `
    .grid { display: grid; gap: 16px; }
    mat-card { border: 1px solid #e2e8f0; box-shadow: none; }
    .hero { display: flex; gap: 16px; align-items: center; padding: 8px; }
    .avatar {
      width: 64px; height: 64px; border-radius: 50%;
      background: #2563eb; color: #fff; display: grid; place-items: center;
      font-size: 1.5rem; font-weight: 600;
    }
    h2 { margin: 0; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center; }
    .stats span { display: block; color: #64748b; font-size: 0.8125rem; }
  `,
})
export class ProfilePage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  protected readonly session = inject(SessionService);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly user = this.session.currentUser;
  protected readonly initial = computed(() => this.user()?.name?.charAt(0) ?? '?');
  protected readonly stats = computed(() => {
    const mine = this.tasks().filter((task) => task.assigneeId === this.user()?.id);
    return {
      total: mine.length,
      todo: mine.filter((task) => task.status === 'todo').length,
      in_progress: mine.filter((task) => task.status === 'in_progress').length,
      done: mine.filter((task) => task.status === 'done').length,
    };
  });

  constructor() {
    this.session.load();
    this.api.tasks().subscribe((tasks) => this.tasks.set(tasks));
  }

  edit(profile: NonNullable<ReturnType<ProfilePage['user']>>) {
    this.dialog
      .open(UserFormDialogComponent, { data: { user: profile } })
      .afterClosed()
      .subscribe((value) => {
        if (!value) return;
        this.api.updateUser(profile.id, value).subscribe(() => this.session.load());
      });
  }
}
