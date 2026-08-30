import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService, Project, User } from '../services/api.service';

@Component({
  selector: 'df-projects',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-title">Projects</h1>
        <p class="page-subtitle">Owned by NestJS. Angular never writes to the database itself.</p>
      </div>
    </header>

    <mat-card class="form-card">
      <mat-card-content>
        <form class="page-toolbar" (ngSubmit)="create()">
          <mat-form-field appearance="outline">
            <mat-label>Project name</mat-label>
            <input matInput [(ngModel)]="name" name="name" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Description</mat-label>
            <input matInput [(ngModel)]="description" name="description" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Owner</mat-label>
            <mat-select [(ngModel)]="ownerId" name="ownerId" required>
              @for (user of users(); track user.id) {
                <mat-option [value]="user.id">{{ user.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-flat-button color="primary" type="submit">Create</button>
        </form>
      </mat-card-content>
    </mat-card>

    <div class="card-grid">
      @for (project of projects(); track project.id) {
        <mat-card>
          <mat-card-header>
            <mat-card-title>{{ project.name }}</mat-card-title>
            <mat-card-subtitle>{{ project.status }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p>{{ project.description }}</p>
          </mat-card-content>
        </mat-card>
      }
    </div>
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
      min-width: 180px;
    }

    .page-toolbar button {
      height: 56px;
      margin-top: 4px;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
  `,
})
export class ProjectsPage {
  private readonly api = inject(ApiService);
  protected readonly projects = signal<Project[]>([]);
  protected readonly users = signal<User[]>([]);
  protected name = '';
  protected description = '';
  protected ownerId = '';

  constructor() {
    this.reload();
    this.api.users().subscribe((users) => {
      this.users.set(users);
      this.ownerId = users[0]?.id ?? '';
    });
  }

  create() {
    this.api
      .createProject({
        name: this.name,
        description: this.description,
        ownerId: this.ownerId,
      })
      .subscribe(() => {
        this.name = '';
        this.description = '';
        this.reload();
      });
  }

  private reload() {
    this.api.projects().subscribe((projects) => this.projects.set(projects));
  }
}
