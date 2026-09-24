import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'df-shell-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    RouterLink,
  ],
  templateUrl: './shell-header.component.html',
  styleUrl: './shell-header.component.scss',
})
export class ShellHeaderComponent {
  private readonly session = inject(SessionService);
  readonly menuToggle = output<void>();
  readonly currentUser = this.session.currentUser;
  readonly users = this.session.users;

  constructor() {
    this.session.load();
  }

  switchUser(id: string) {
    this.session.setUser(id);
  }
}
