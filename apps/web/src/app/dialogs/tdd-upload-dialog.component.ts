import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
import { MatIconModule } from '@angular/material/icon';
import { Project } from '../services/api.service';

export interface TddUploadDialogData {
  projects: Project[];
  projectId?: string;
}

export interface TddUploadDialogResult {
  projectId: string;
  title: string;
  file: File;
}

@Component({
  selector: 'df-tdd-upload-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Upload TDD Document</h2>
    <mat-dialog-content [formGroup]="form" class="dialog-form">
      <mat-form-field appearance="outline">
        <mat-label>Project</mat-label>
        <mat-select formControlName="projectId">
          @for (project of data.projects; track project.id) {
            <mat-option [value]="project.id">{{ project.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <div class="file-drop-zone">
        <input
          #fileInput
          type="file"
          accept=".pdf,.md,.markdown,.txt,.docx"
          (change)="onFile($event)"
          style="display: none"
        />
        <button
          mat-stroked-button
          type="button"
          (click)="fileInput.click()"
        >
          <mat-icon>attach_file</mat-icon>
          Choose File (.pdf, .md, .txt, .docx)
        </button>

        @if (selectedFile) {
          <div class="file-info">
            <span class="file-name">{{ selectedFile.name }}</span>
            <span class="file-size">({{ (selectedFile.size / 1024).toFixed(1) }} KB)</span>
          </div>
        }
      </div>

      <mat-form-field appearance="outline">
        <mat-label>Title / Description</mat-label>
        <input matInput formControlName="title" placeholder="e.g. Auth Architecture Spec" />
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="form.invalid || !selectedFile"
        (click)="submit()"
      >
        Upload
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 420px;
      padding-top: 12px;
    }
    .file-drop-zone {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    .file-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      color: #334155;
      margin-top: 4px;
    }
    .file-name {
      font-weight: 500;
    }
    .file-size {
      color: #64748b;
    }
  `,
})
export class TddUploadDialogComponent {
  readonly dialogRef = inject(MatDialogRef<TddUploadDialogComponent, TddUploadDialogResult>);
  readonly data = inject<TddUploadDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  protected selectedFile: File | null = null;

  readonly form = this.fb.nonNullable.group({
    projectId: [this.data.projectId || this.data.projects[0]?.id || '', Validators.required],
    title: ['', Validators.required],
  });

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.selectedFile = file;

    // Default the title input to the clean file name if currently empty
    if (!this.form.controls.title.value) {
      const cleanName = file.name.replace(/\.[^.]+$/, '');
      this.form.controls.title.setValue(cleanName);
    }
  }

  submit(): void {
    if (this.form.invalid || !this.selectedFile) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.dialogRef.close({
      projectId: value.projectId,
      title: value.title,
      file: this.selectedFile,
    });
  }
}