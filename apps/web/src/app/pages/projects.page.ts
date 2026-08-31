import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog.component';
import { ProjectFormDialogComponent } from '../dialogs/project-form-dialog.component';
import { ApiService, Project, User } from '../services/api.service';
import { PriorityChipComponent } from '../ui/priority-chip.component';
import { StatusBoardComponent, StatusColumn } from '../ui/status-board.component';
import { ViewToggleComponent } from '../ui/view-toggle.component';

@Component({
  selector: 'df-projects',
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
        <h1 class="page-title">Projects</h1>
        <p class="page-subtitle">
          List or grid board. Priority is color-coded. Drag tiles between columns to change status.
        </p>
      </div>
      <div class="header-actions">
        <df-view-toggle [view]="view()" (viewChange)="setView($event)" />
        <button mat-flat-button color="primary" type="button" (click)="openCreate()">
          <mat-icon>add</mat-icon>
          New project
        </button>
      </div>
    </header>

    @if (view() === 'list') {
      <table mat-table [dataSource]="projects()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let project">
            <strong>{{ project.name }}</strong>
            <div class="cell-desc">{{ project.description }}</div>
          </td>
        </ng-container>
        <ng-container matColumnDef="owner">
          <th mat-header-cell *matHeaderCellDef>Owner</th>
          <td mat-cell *matCellDef="let project">{{ ownerName(project.ownerId) }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let project">{{ statusLabel(project.status) }}</td>
        </ng-container>
        <ng-container matColumnDef="priority">
          <th mat-header-cell *matHeaderCellDef>Priority</th>
          <td mat-cell *matCellDef="let project">
            <df-priority-chip [priority]="project.priority" />
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let project">
            <button
              mat-icon-button
              type="button"
              class="df-action-edit"
              matTooltip="Edit"
              (click)="openEdit(project)"
            >
              <mat-icon>edit</mat-icon>
            </button>
            <button
              mat-icon-button
              type="button"
              class="df-action-delete"
              matTooltip="Delete"
              (click)="remove(project)"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns" [class]="'row-' + row.priority"></tr>
      </table>
    } @else {
      <df-status-board [columns]="boardColumns" [items]="projects()" (statusChange)="onMoved($event)">
        <ng-template let-project>
          <div class="tile-title">{{ project.name }}</div>
          <div class="tile-meta">{{ ownerName(project.ownerId) }}</div>
          <p class="tile-desc">{{ project.description }}</p>
          <df-priority-chip [priority]="project.priority" />
          <div class="tile-actions">
            <button mat-icon-button type="button" (click)="openEdit(project); $event.stopPropagation()">
              <mat-icon>edit</mat-icon>
            </button>
            <button
              mat-icon-button
              type="button"
              class="df-action-delete"
              (click)="remove(project); $event.stopPropagation()"
            >
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
    .cell-desc,
    .tile-desc {
      color: #64748b;
      font-size: 0.8125rem;
    }
    .tile-desc {
      margin: 0 0 8px;
    }
    .df-action-edit {
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
export class ProjectsPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  protected readonly projects = signal<Project[]>([]);
  protected readonly users = signal<User[]>([]);
  protected readonly view = signal<'list' | 'grid'>(
    (localStorage.getItem('devflow-projects-view') as 'list' | 'grid') || 'grid'
  );
  protected readonly columns = ['name', 'owner', 'status', 'priority', 'actions'];
  protected readonly boardColumns: StatusColumn[] = [
    { id: 'planning', label: 'Planning' },
    { id: 'active', label: 'Active' },
    { id: 'on_hold', label: 'On hold' },
    { id: 'completed', label: 'Completed' },
    { id: 'archived', label: 'Archived' },
  ];

  constructor() {
    this.reload();
  }

  setView(mode: 'list' | 'grid') {
    this.view.set(mode);
    localStorage.setItem('devflow-projects-view', mode);
  }

  statusLabel(status: string) {
    return this.boardColumns.find((column) => column.id === status)?.label ?? status;
  }

  ownerName(id: string) {
    return this.users().find((user) => user.id === id)?.name ?? 'Unknown';
  }

  onMoved(event: { item: Project; status: string }) {
    this.projects.update((list) =>
      list.map((project) =>
        project.id === event.item.id ? { ...project, status: event.status } : project
      )
    );
    this.api.updateProject(event.item.id, { status: event.status }).subscribe({
      error: () => this.reload(),
    });
  }

  openCreate() {
    this.dialog
      .open(ProjectFormDialogComponent, { data: { users: this.users() } })
      .afterClosed()
      .subscribe((value) => {
        if (!value) return;
        this.api.createProject(value).subscribe(() => this.reload());
      });
  }

  openEdit(project: Project) {
    this.dialog
      .open(ProjectFormDialogComponent, { data: { project, users: this.users() } })
      .afterClosed()
      .subscribe((value) => {
        if (!value) return;
        this.api.updateProject(project.id, value).subscribe(() => this.reload());
      });
  }

  remove(project: Project) {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete project',
          message: `Delete ${project.name} and its tasks?`,
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.deleteProject(project.id).subscribe(() => this.reload());
      });
  }

  private reload() {
    this.api.users().subscribe((users) => this.users.set(users));
    this.api.projects().subscribe((projects) => this.projects.set(projects));
  }
}
