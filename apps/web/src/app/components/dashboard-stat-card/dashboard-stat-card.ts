import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
@Component({
  selector: 'df-dashboard-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule], 
  templateUrl: './dashboard-stat-card.html',
  styleUrl: './dashboard-stat-card.css',
})
export class DashboardStatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly icon = input.required<string>();
  readonly color = input<'blue' | 'amber' | 'green' | 'slate'>('blue');
}
