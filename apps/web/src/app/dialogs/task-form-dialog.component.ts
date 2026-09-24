import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Project, Task, User } from '../services/api.service';

export interface TaskFormData {
  task?: Task;
  projects: Project[];
  users: User[];
}

@Component({
  selector: 'df-task-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.task ? 'Edit task' : 'New task' }}</h2>
    <mat-dialog-content [formGroup]="form" class="dialog-form">
      <mat-form-field appearance="outline">
        <mat-label>Project</mat-label>
        <mat-select formControlName="projectId">
          @for (project of data.projects; track project.id) {
            <mat-option [value]="project.id">{{ project.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Title</mat-label>
        <input matInput formControlName="title" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Description</mat-label>
        <textarea matInput rows="3" formControlName="description"></textarea>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select formControlName="status">
          <mat-option value="todo">To do</mat-option>
          <mat-option value="in_progress">In progress</mat-option>
          <mat-option value="done">Done</mat-option>
          <mat-option value="blocked">Blocked</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Priority</mat-label>
        <mat-select formControlName="priority">
          <mat-option value="low">Low</mat-option>
          <mat-option value="medium">Medium</mat-option>
          <mat-option value="high">High</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Assignee</mat-label>
        <mat-select formControlName="assigneeId">
          <mat-option value="">Unassigned</mat-option>
          @for (user of data.users; track user.id) {
            <mat-option [value]="user.id">{{ user.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()">Save</button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-form {
      display: flex;
      flex-direction: column;
      min-width: 380px;
      padding-top: 8px;
    }
  `,
})
export class TaskFormDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<TaskFormDialogComponent>);
  readonly data = inject<TaskFormData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    projectId: ['', Validators.required],
    title: ['', Validators.required],
    description: [''],
    status: ['todo'],
    priority: ['medium'],
    assigneeId: [''],
  });

  ngOnInit(): void {
    this.form.patchValue({
      projectId: this.data.task?.projectId ?? this.data.projects[0]?.id ?? '',
      title: this.data.task?.title ?? '',
      description: this.data.task?.description ?? '',
      status: this.data.task?.status ?? 'todo',
      priority: this.data.task?.priority ?? 'medium',
      assigneeId: this.data.task?.assigneeId ?? '',
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({
      ...value,
      assigneeId: value.assigneeId || undefined,
    });
  }
}
