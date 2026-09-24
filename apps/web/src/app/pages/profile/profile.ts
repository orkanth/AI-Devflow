import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { UserFormDialogComponent } from '../../dialogs/user-form-dialog.component';
import { ApiService, Task } from '../../services/api.service';
import { SessionService } from '../../services/session.service';

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
  templateUrl: './profile.html',
  styleUrl: './profile.css',
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
