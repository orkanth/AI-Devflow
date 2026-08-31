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
import { Project, User } from '../services/api.service';

export interface ProjectFormData {
  project?: Project;
  users: User[];
}

@Component({
  selector: 'df-project-form-dialog',
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
    <h2 mat-dialog-title>{{ data.project ? 'Edit project' : 'New project' }}</h2>
    <mat-dialog-content [formGroup]="form" class="dialog-form">
      <mat-form-field appearance="outline">
        <mat-label>Name</mat-label>
        <input matInput formControlName="name" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Description</mat-label>
        <textarea matInput rows="3" formControlName="description"></textarea>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Owner</mat-label>
        <mat-select formControlName="ownerId">
          @for (user of data.users; track user.id) {
            <mat-option [value]="user.id">{{ user.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select formControlName="status">
          <mat-option value="planning">Planning</mat-option>
          <mat-option value="active">Active</mat-option>
          <mat-option value="on_hold">On hold</mat-option>
          <mat-option value="completed">Completed</mat-option>
          <mat-option value="archived">Archived</mat-option>
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
      min-width: 360px;
      padding-top: 8px;
    }
  `,
})
export class ProjectFormDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<ProjectFormDialogComponent>);
  readonly data = inject<ProjectFormData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: ['', Validators.required],
    ownerId: ['', Validators.required],
    status: ['active'],
    priority: ['medium'],
  });

  ngOnInit(): void {
    const firstUser = this.data.users[0]?.id ?? '';
    this.form.patchValue({
      ownerId: this.data.project?.ownerId ?? firstUser,
      name: this.data.project?.name ?? '',
      description: this.data.project?.description ?? '',
      status: this.data.project?.status ?? 'active',
      priority: this.data.project?.priority ?? 'medium',
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.getRawValue());
  }
}
