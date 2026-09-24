import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from '../../dialogs/confirm-dialog.component';
import { TaskFormDialogComponent } from '../../dialogs/task-form-dialog.component';
import { ApiService, Project, Task, User } from '../../services/api.service';
import { PriorityChipComponent } from '../../ui/priority-chip.component';
import { StatusBoardComponent, StatusColumn } from '../../ui/status-board.component';
import { ViewToggleComponent } from '../../ui/view-toggle.component';

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
  templateUrl: './tasks.html',
  styleUrl: './tasks.css',
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
