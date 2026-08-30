import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Project, User } from '../services/api.service';

@Component({
  selector: 'df-projects',
  imports: [FormsModule],
  template: `
    <header class="page-head">
      <div>
        <h1>Projects</h1>
        <p>Owned by NestJS. Angular never writes to the database itself.</p>
      </div>
    </header>

    <form class="form-row" (ngSubmit)="create()">
      <input [(ngModel)]="name" name="name" placeholder="Project name" required />
      <input [(ngModel)]="description" name="description" placeholder="Description" required />
      <select [(ngModel)]="ownerId" name="ownerId" required>
        <option value="">Owner</option>
        @for (user of users(); track user.id) {
          <option [value]="user.id">{{ user.name }}</option>
        }
      </select>
      <button type="submit">Create</button>
    </form>

    <div class="grid">
      @for (project of projects(); track project.id) {
        <article class="panel">
          <h2>{{ project.name }}</h2>
          <p>{{ project.description }}</p>
          <small>{{ project.status }}</small>
        </article>
      }
    </div>
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
