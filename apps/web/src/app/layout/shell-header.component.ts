import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'df-shell-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule],
  templateUrl: './shell-header.component.html',
  styleUrl: './shell-header.component.scss',
})
export class ShellHeaderComponent {
  readonly menuToggle = output<void>();
}
