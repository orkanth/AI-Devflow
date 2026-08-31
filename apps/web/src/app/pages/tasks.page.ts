import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog.component';
import { TaskFormDialogComponent } from '../dialogs/task-form-dialog.component';
import { ApiService, Project, Task, User } from '../services/api.service';
import { PriorityChipComponent } from '../ui/priority-chip.component';
import { StatusBoardComponent, StatusColumn } from '../ui/status-board.component';
import { ViewToggleComponent } from '../ui/view-toggle.component';

@Component({
  selector: 'df-tasks',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    PriorityChipComponent,
    StatusBoardComponent,
    ViewToggleComponent,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-title">Tasks</h1>
        <p class="page-subtitle">
          List or grid board. Priority is color-coded. Drag tiles between columns to change status.
        </p>
      </div>
      <div class="header-actions">
        <df-view-toggle [view]="view()" (viewChange)="setView($event)" />
        <button mat-flat-button color="primary" type="button" (click)="openCreate()">
          <mat-icon>add_task</mat-icon>
          New task
        </button>
      </div>
    </header>

    @if (view() === 'list') {
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
          <td mat-cell *matCellDef="let task">{{ statusLabel(task.status) }}</td>
        </ng-container>
        <ng-container matColumnDef="priority">
          <th mat-header-cell *matHeaderCellDef>Priority</th>
          <td mat-cell *matCellDef="let task">
            <df-priority-chip [priority]="task.priority" />
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let task">
            <button mat-icon-button type="button" class="df-action-edit" matTooltip="Edit" (click)="openEdit(task)">
              <mat-icon>edit</mat-icon>
            </button>
            <button
              mat-icon-button
              type="button"
              class="df-action-delete"
              matTooltip="Delete"
              (click)="remove(task)"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns" [class]="'row-' + row.priority"></tr>
      </table>
    } @else {
      <df-status-board [columns]="boardColumns" [items]="tasks()" (statusChange)="onMoved($event)">
        <ng-template let-task>
          <div class="tile-title">{{ task.title }}</div>
          <div class="tile-meta">{{ projectName(task.projectId) }} · {{ userName(task.assigneeId) }}</div>
          <df-priority-chip [priority]="task.priority" />
          <div class="tile-actions">
            <button mat-icon-button type="button" (click)="openEdit(task); $event.stopPropagation()">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button type="button" (click)="remove(task); $event.stopPropagation()">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </ng-template>
      </df-status-board>
    }
  `,
  styles: `
    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    table {
      width: 100%;
      background: #fff;
    }
    .cell-desc {
      color: #64748b;
      font-size: 0.8125rem;
    }
    .df-action-edit,
    .tile-actions button {
      color: #2563eb;
    }
    .df-action-delete {
      color: #dc2626;
    }
    tr.row-high {
      box-shadow: inset 4px 0 0 #dc2626;
    }
    tr.row-medium {
      box-shadow: inset 4px 0 0 #d97706;
    }
    tr.row-low {
      box-shadow: inset 4px 0 0 #2563eb;
    }
    .tile-title {
      font-weight: 600;
      color: #0f172a;
    }
    .tile-meta {
      color: #64748b;
      font-size: 0.75rem;
      margin: 4px 0 8px;
    }
    .tile-actions {
      display: flex;
      justify-content: flex-end;
      margin: 0 -8px -4px;
    }
  `,
})
export class TasksPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly users = signal<User[]>([]);
  protected readonly view = signal<'list' | 'grid'>(
    (localStorage.getItem('devflow-tasks-view') as 'list' | 'grid') || 'grid'
  );
  protected readonly columns = ['title', 'project', 'assignee', 'status', 'priority', 'actions'];
  protected readonly boardColumns: StatusColumn[] = [
    { id: 'todo', label: 'To do' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'blocked', label: 'Blocked' },
    { id: 'done', label: 'Done' },
  ];

  constructor() {
    this.reload();
  }

  setView(mode: 'list' | 'grid') {
    this.view.set(mode);
    localStorage.setItem('devflow-tasks-view', mode);
  }

  statusLabel(status: string) {
    return this.boardColumns.find((column) => column.id === status)?.label ?? status;
  }

  projectName(id: string) {
    return this.projects().find((project) => project.id === id)?.name ?? '—';
  }

  userName(id?: string) {
    if (!id) return 'Unassigned';
    return this.users().find((user) => user.id === id)?.name ?? '—';
  }

  onMoved(event: { item: Task; status: string }) {
    this.tasks.update((list) =>
      list.map((task) => (task.id === event.item.id ? { ...task, status: event.status } : task))
    );
    this.api.updateTask(event.item.id, { status: event.status }).subscribe({
      error: () => this.reload(),
    });
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
