import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Project, Task } from '../services/api.service';

@Component({
  selector: 'df-tasks',
  imports: [FormsModule],
  template: `
    <header class="page-head">
      <div>
        <h1>Tasks</h1>
        <p>The task agent’s tools POST here. This is the system of record.</p>
      </div>
    </header>

    <form class="form-row" (ngSubmit)="create()">
      <select [(ngModel)]="projectId" name="projectId" required>
        @for (project of projects(); track project.id) {
          <option [value]="project.id">{{ project.name }}</option>
        }
      </select>
      <input [(ngModel)]="title" name="title" placeholder="Task title" required />
      <input [(ngModel)]="description" name="description" placeholder="Description" required />
      <button type="submit">Create</button>
    </form>

    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Status</th>
          <th>Priority</th>
        </tr>
      </thead>
      <tbody>
        @for (task of tasks(); track task.id) {
          <tr>
            <td>
              <b>{{ task.title }}</b>
              <div>{{ task.description }}</div>
            </td>
            <td><span class="pill">{{ task.status }}</span></td>
            <td>{{ task.priority }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class TasksPage {
  private readonly api = inject(ApiService);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly projects = signal<Project[]>([]);
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
