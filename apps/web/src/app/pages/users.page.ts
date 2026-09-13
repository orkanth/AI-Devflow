import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from '../dialogs/confirm-dialog.component';
import { UserFormDialogComponent } from '../dialogs/user-form-dialog.component';
import { ApiService, User } from '../services/api.service';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'df-users',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1 class="page-title">Users</h1>
        <p class="page-subtitle">Team members who can be assigned to tasks — manually or by the agent.</p>
      </div>
      <button mat-flat-button color="primary" type="button" (click)="openCreate()">
        <mat-icon>person_add</mat-icon>
        New user
      </button>
    </header>

    <mat-form-field appearance="outline" class="search">
      <mat-label>Search users</mat-label>
      <mat-icon matPrefix>search</mat-icon>
      <input matInput [value]="query()" (input)="query.set($any($event.target).value)" />
    </mat-form-field>

    <table mat-table [dataSource]="filtered()">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Name</th>
        <td mat-cell *matCellDef="let user">{{ user.name }}</td>
      </ng-container>
      <ng-container matColumnDef="email">
        <th mat-header-cell *matHeaderCellDef>Email</th>
        <td mat-cell *matCellDef="let user">{{ user.email }}</td>
      </ng-container>
      <ng-container matColumnDef="role">
        <th mat-header-cell *matHeaderCellDef>Role</th>
        <td mat-cell *matCellDef="let user">{{ user.role }}</td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let user">
          <button mat-icon-button type="button" class="df-action-edit" matTooltip="Edit" (click)="openEdit(user)">
            <mat-icon>edit</mat-icon>
          </button>
          <button mat-icon-button type="button" class="df-action-delete" matTooltip="Delete" (click)="remove(user)">
            <mat-icon>delete</mat-icon>
          </button>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
  `,
  styles: `
    .search { width: 100%; margin-bottom: 8px; }
    table { width: 100%; background: #fff; }
    .df-action-edit { color: #2563eb; }
    .df-action-delete { color: #dc2626; }
  `,
})
export class UsersPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly session = inject(SessionService);
  protected readonly users = signal<User[]>([]);
  protected readonly query = signal('');
  protected readonly columns = ['name', 'email', 'role', 'actions'];

  constructor() {
    this.reload();
  }

  filtered() {
    const q = this.query().toLowerCase();
    return this.users().filter(
      (user) => user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)
    );
  }

  openCreate() {
    this.dialog
      .open(UserFormDialogComponent, { data: {} })
      .afterClosed()
      .subscribe((value) => {
        if (!value) return;
        this.api.createUser(value).subscribe(() => this.reload());
      });
  }

  openEdit(user: User) {
    this.dialog
      .open(UserFormDialogComponent, { data: { user } })
      .afterClosed()
      .subscribe((value) => {
        if (!value) return;
        this.api.updateUser(user.id, value).subscribe(() => this.reload());
      });
  }

  remove(user: User) {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete user',
          message: `Delete ${user.name}? Their owned projects are reassigned and tasks unassigned.`,
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.deleteUser(user.id).subscribe(() => this.reload());
      });
  }

  private reload() {
    this.api.users().subscribe((users) => {
      this.users.set(users);
      this.session.load();
    });
  }
}
