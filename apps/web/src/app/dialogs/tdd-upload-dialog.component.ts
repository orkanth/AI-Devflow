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
import { Project } from '../services/api.service';

export interface TddUploadDialogData {
  projects: Project[];
  projectId?: string;
}

export interface TddUploadResult {
  projectId: string;
  title: string;
  content: string;
  source: string;
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
  ],
  template: `
    <h2 mat-dialog-title>Upload TDD document</h2>
    <mat-dialog-content [formGroup]="form" class="dialog-form">
      <mat-form-field appearance="outline">
        <mat-label>Project</mat-label>
        <mat-select formControlName="projectId">
          @for (project of data.projects; track project.id) {
            <mat-option [value]="project.id">{{ project.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <label class="file-label">
        <span>File</span>
        <input type="file" (change)="onFile($event)" />
      </label>
      @if (fileName) {
        <p class="file-name">{{ fileName }}</p>
      }
      <mat-form-field appearance="outline">
        <mat-label>Title</mat-label>
        <input matInput formControlName="title" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" type="button" [disabled]="form.invalid || !fileName" (click)="submit()">
        Upload
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-form {
      display: flex;
      flex-direction: column;
      min-width: 380px;
      padding-top: 8px;
    }
    .file-label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
      font-size: 0.75rem;
      color: #64748b;
    }
    .file-name {
      margin: 0 0 8px;
      font-size: 0.875rem;
      color: #0f172a;
    }
  `,
})
export class TddUploadDialogComponent {
  readonly dialogRef = inject(MatDialogRef<TddUploadDialogComponent, TddUploadResult>);
  readonly data = inject<TddUploadDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  protected fileName = '';
  private fileContent = '';

  readonly form = this.fb.nonNullable.group({
    projectId: [this.data.projectId || this.data.projects[0]?.id || '', Validators.required],
    title: ['', Validators.required],
  });

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.fileName = file.name;
    const raw = await file.text();
    this.fileContent = this.normalizeContent(file, raw);
    if (!this.form.controls.title.value) {
      this.form.controls.title.setValue(file.name.replace(/\.[^.]+$/, '') || file.name);
    }
  }

  submit(): void {
    if (this.form.invalid || !this.fileContent) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({
      projectId: value.projectId,
      title: value.title,
      content: this.fileContent,
      source: this.fileName ? `tdd:${this.fileName}` : 'tdd-upload',
    });
  }

  private normalizeContent(file: File, raw: string): string {
    const printable = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
    const body =
      printable.length >= 10
        ? printable.slice(0, 20_000)
        : `Uploaded TDD document "${file.name}" (${file.size} bytes, ${file.type || 'unknown type'}).`;
    return body.length >= 10 ? body : `${body} document`;
  }
}
