import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TddUploadDialogComponent } from '../../dialogs/tdd-upload-dialog.component';
import { ApiService, KnowledgeDoc, Project } from '../../services/api.service';
import { ConfirmDialogComponent } from '../../dialogs/confirm-dialog.component';

@Component({
  selector: 'df-tdd-upload',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTableModule,
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
  protected readonly columns = ['title', 'source', 'delete'];

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

  openUpload() {
    this.dialog
      .open(TddUploadDialogComponent, {
        data: { projects: this.projects(), projectId: this.projectId() },
      })
      .afterClosed()
      .subscribe((value) => {
        if (!value) return;
        this.api.ingest(value).subscribe(() => {
          this.projectId.set(value.projectId);
          this.reload();
        });
      });
  }

    remove(doc: doc) {
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: 'Delete user',
            message: `Delete ${doc.name}? .`,
          },
        })
        .afterClosed()
        .subscribe((ok) => {
          if (!ok) return;
          this.api.deleteUser(doc.id).subscribe(() => this.reload());
        });
    }

  private reload() {
    const projectId = this.projectId();
    this.api.knowledge(projectId || undefined).subscribe((docs) => this.docs.set(docs));
  }
}
