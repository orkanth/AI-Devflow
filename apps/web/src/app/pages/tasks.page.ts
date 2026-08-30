import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog.component';
import { TaskFormDialogComponent } from '../dialogs/task-form-dialog.component';
import { ApiService, Project, Task, User } from '../services/api.service';

@Component({
  selector: 'df-tasks',
  imports: [MatButtonModule, MatChipsModule, MatIconModule, MatTableModule, MatTooltipModule],
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-title">Tasks</h1>
        <p class="page-subtitle">Assign, edit, and delete here or ask the agent (e.g. assign … to Ada Lovelace).</p>
      </div>
      <button mat-flat-button color="primary" type="button" (click)="openCreate()">
        <mat-icon>add_task</mat-icon>
        New task
      </button>
    </header>

    <table mat-table [dataSource]="tasks()">
      <ng-container matColumnDef="title">
        <th mat-header-cell *matHeaderCellDef>Title</th>
        <td mat-cell *matCellDef="let task">
          <strong>{{ task.title }}</strong>
          <div class="cell-desc">{{ task.description }}</div>
        </td>
      </ng-container>
      <ng-container matColumnDef="project">
        <th mat-header-cell *matHeaderCellDef>Project</th>
        <td mat-cell *matCellDef="let task">{{ projectName(task.projectId) }}</td>
      </ng-container>
      <ng-container matColumnDef="assignee">
        <th mat-header-cell *matHeaderCellDef>Assignee</th>
        <td mat-cell *matCellDef="let task">{{ userName(task.assigneeId) }}</td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let task">
          <mat-chip>{{ task.status }}</mat-chip>
        </td>
      </ng-container>
      <ng-container matColumnDef="priority">
        <th mat-header-cell *matHeaderCellDef>Priority</th>
        <td mat-cell *matCellDef="let task">{{ task.priority }}</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let task">
          <button mat-icon-button type="button" class="df-action-edit" matTooltip="Edit" (click)="openEdit(task)">
            <mat-icon>edit</mat-icon>
          </button>
          <button mat-icon-button type="button" class="df-action-delete" matTooltip="Delete" (click)="remove(task)">
            <mat-icon>delete</mat-icon>
          </button>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
  `,
  styles: `
    table { width: 100%; background: #fff; }
    .cell-desc { color: #64748b; font-size: 0.8125rem; }
    .df-action-edit { color: #2563eb; }
    .df-action-delete { color: #dc2626; }
  `,
})
export class TasksPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly users = signal<User[]>([]);
  protected readonly columns = ['title', 'project', 'assignee', 'status', 'priority', 'actions'];

  constructor() {
    this.reload();
  }

  projectName(id: string) {
    return this.projects().find((project) => project.id === id)?.name ?? '—';
  }

  userName(id?: string) {
    if (!id) return 'Unassigned';
    return this.users().find((user) => user.id === id)?.name ?? '—';
  }

  openCreate() {
    this.dialog
      .open(TaskFormDialogComponent, {
        data: { projects: this.projects(), users: this.users() },
      })
      .afterClosed()
      .subscribe((value) => {
        if (!value) return;
        this.api.createTask(value).subscribe(() => this.reload());
      });
  }

  openEdit(task: Task) {
    this.dialog
      .open(TaskFormDialogComponent, {
        data: { task, projects: this.projects(), users: this.users() },
      })
      .afterClosed()
      .subscribe((value) => {
        if (!value) return;
        this.api.updateTask(task.id, value).subscribe(() => this.reload());
      });
  }

  remove(task: Task) {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: { title: 'Delete task', message: `Delete "${task.title}"?` },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.deleteTask(task.id).subscribe(() => this.reload());
      });
  }

  private reload() {
    this.api.users().subscribe((users) => this.users.set(users));
    this.api.projects().subscribe((projects) => this.projects.set(projects));
    this.api.tasks().subscribe((tasks) => this.tasks.set(tasks));
  }
}
