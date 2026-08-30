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
import { User } from '../services/api.service';

export interface UserFormData {
  user?: User;
}

@Component({
  selector: 'df-user-form-dialog',
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
    <h2 mat-dialog-title>{{ data.user ? 'Edit user' : 'New user' }}</h2>
    <mat-dialog-content [formGroup]="form" class="dialog-form">
      <mat-form-field appearance="outline">
        <mat-label>Name</mat-label>
        <input matInput formControlName="name" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Email</mat-label>
        <input matInput formControlName="email" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Role</mat-label>
        <mat-select formControlName="role">
          <mat-option value="engineer">Engineer</mat-option>
          <mat-option value="pm">PM</mat-option>
          <mat-option value="admin">Admin</mat-option>
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
      gap: 4px;
      min-width: 320px;
      padding-top: 8px;
    }
  `,
})
export class UserFormDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<UserFormDialogComponent>);
  readonly data = inject<UserFormData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['engineer', Validators.required],
  });

  ngOnInit(): void {
    if (this.data.user) {
      this.form.patchValue(this.data.user);
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.getRawValue());
  }
}
