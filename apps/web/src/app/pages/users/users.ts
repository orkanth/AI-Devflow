import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from '../../dialogs/confirm-dialog.component';
import { UserFormDialogComponent } from '../../dialogs/user-form-dialog.component';
import { ApiService, User } from '../../services/api.service';
import { SessionService } from '../../services/session.service';

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
  templateUrl: './users.html',
  styleUrl: './users.css',
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
      (user) => user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q) || user.role.toLowerCase().includes(q)
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
