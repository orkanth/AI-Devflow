import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog.component';
import { ProjectFormDialogComponent } from '../dialogs/project-form-dialog.component';
import { ApiService, Project, User } from '../services/api.service';

@Component({
  selector: 'df-projects',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-title">Projects</h1>
        <p class="page-subtitle">Create, edit, archive, or delete — in the UI or via the AI console.</p>
      </div>
      <button mat-flat-button color="primary" type="button" (click)="openCreate()">
        <mat-icon>add</mat-icon>
        New project
      </button>
    </header>

    <div class="card-grid">
      @for (project of projects(); track project.id) {
        <mat-card>
          <mat-card-header>
            <mat-card-title>{{ project.name }}</mat-card-title>
            <mat-card-subtitle>{{ project.status }} · {{ ownerName(project.ownerId) }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p>{{ project.description }}</p>
          </mat-card-content>
          <mat-card-actions align="end">
            <button mat-button color="primary" type="button" (click)="openEdit(project)">Edit</button>
            <button mat-button color="warn" type="button" (click)="remove(project)">Delete</button>
          </mat-card-actions>
        </mat-card>
      }
    </div>
  `,
  styles: `
    mat-card {
      border: 1px solid #e2e8f0;
      box-shadow: none;
    }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
  `,
})
export class ProjectsPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  protected readonly projects = signal<Project[]>([]);
  protected readonly users = signal<User[]>([]);

  constructor() {
    this.reload();
  }

  ownerName(id: string) {
    return this.users().find((user) => user.id === id)?.name ?? 'Unknown';
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
