import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ApiService, Project, Task } from '../services/api.service';

@Component({
  selector: 'df-tasks',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-title">Tasks</h1>
        <p class="page-subtitle">The task agent’s tools POST here. This is the system of record.</p>
      </div>
    </header>

    <mat-card class="form-card">
      <mat-card-content>
        <form class="page-toolbar" (ngSubmit)="create()">
          <mat-form-field appearance="outline">
            <mat-label>Project</mat-label>
            <mat-select [(ngModel)]="projectId" name="projectId" required>
              @for (project of projects(); track project.id) {
                <mat-option [value]="project.id">{{ project.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Task title</mat-label>
            <input matInput [(ngModel)]="title" name="title" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Description</mat-label>
            <input matInput [(ngModel)]="description" name="description" required />
          </mat-form-field>
          <button mat-flat-button color="primary" type="submit">Create</button>
        </form>
      </mat-card-content>
    </mat-card>

    <mat-card>
      <table mat-table [dataSource]="tasks()">
        <ng-container matColumnDef="title">
          <th mat-header-cell *matHeaderCellDef>Title</th>
          <td mat-cell *matCellDef="let task">
            <strong>{{ task.title }}</strong>
            <div class="cell-desc">{{ task.description }}</div>
          </td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let task">
            <mat-chip-set>
              <mat-chip>{{ task.status }}</mat-chip>
            </mat-chip-set>
          </td>
        </ng-container>
        <ng-container matColumnDef="priority">
          <th mat-header-cell *matHeaderCellDef>Priority</th>
          <td mat-cell *matCellDef="let task">{{ task.priority }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
    </mat-card>
  `,
  styles: `
    .form-card,
    mat-card {
      border: 1px solid #e2e8f0;
      box-shadow: none;
    }

    .form-card {
      margin-bottom: 24px;
    }

    .page-toolbar mat-form-field {
      flex: 1;
      min-width: 160px;
    }

    .page-toolbar button {
      height: 56px;
      margin-top: 4px;
    }

    table {
      width: 100%;
    }

    .cell-desc {
      color: #64748b;
      font-size: 0.8125rem;
    }
  `,
})
export class TasksPage {
  private readonly api = inject(ApiService);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly columns = ['title', 'status', 'priority'];
  protected projectId = '';
  protected title = '';
  protected description = '';

  constructor() {
    this.api.projects().subscribe((projects) => {
      this.projects.set(projects);
      this.projectId = projects[0]?.id ?? '';
    });
    this.reload();
  }

  create() {
    this.api
      .createTask({
        projectId: this.projectId,
        title: this.title,
        description: this.description,
      })
      .subscribe(() => {
        this.title = '';
        this.description = '';
        this.reload();
      });
  }

  private reload() {
    this.api.tasks().subscribe((tasks) => this.tasks.set(tasks));
  }
}
