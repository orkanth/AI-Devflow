import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from '../../dialogs/confirm-dialog.component';
import { TddUploadDialogComponent } from '../../dialogs/tdd-upload-dialog.component';
import { ApiService, KnowledgeDoc, Project } from '../../services/api.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'df-tdd-upload',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    DatePipe
  ],
  templateUrl: './tdd-upload.html',
  styleUrl: './tdd-upload.css',
})
export class TddUploadPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  protected readonly projects = signal<Project[]>([]);
  protected readonly docs = signal<KnowledgeDoc[]>([]);
  protected readonly projectId = signal('');
  protected readonly columns = ['title', 'source', 'actions'];

  constructor() {
    this.api.projects().subscribe((projects) => {
      this.projects.set(projects);
      if (!this.projectId() && projects[0]) {
        this.projectId.set(projects[0].id);
      }
      this.reload();
    });
  }

  projectName(id: string) {
    return this.projects().find((project) => project.id === id)?.name ?? '—';
  }

  onProjectChange(id: string) {
    this.projectId.set(id);
    this.reload();
  }

  openUpload(): void {
    const dialogRef = this.dialog.open(TddUploadDialogComponent, {
      data: {
        projects: this.projects(),
        projectId: this.projectId(),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result || !result.file) {
        return;
      }

      // 1. Pack the file into FormData
      const formData = new FormData();
      if (result.title) {
        formData.append('title', result.title);
      }
      formData.append('file', result.file);

      // 2. Call the upload method
      this.api.uploadDocument(result.projectId, formData).subscribe({
        next: () => {
          // 3. Reload document list
          this.reload();
        },
        error: (err) => {
          console.error('Failed to upload file:', err);
        },
      });
    });
  }

  remove(doc: KnowledgeDoc) {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete document',
          message: `Delete "${doc.title}"? This removes it from the project knowledge store.`,
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.deleteKnowledge(doc.id).subscribe(() => this.reload());
      });
  }

  private reload() {
    const projectId = this.projectId();
    this.api.knowledge(projectId || undefined).subscribe((docs) => this.docs.set(docs));
  }
}