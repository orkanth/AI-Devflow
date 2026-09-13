import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'df-dashboard-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule],
  template: `
    <mat-card class="stat-card">
      <div class="stat-card__icon" [class]="'stat-card__icon--' + color()">
        <mat-icon>{{ icon() }}</mat-icon>
      </div>
      <div class="stat-card__content">
        <span class="stat-card__value">{{ value() }}</span>
        <span class="stat-card__label">{{ label() }}</span>
      </div>
    </mat-card>
  `,
  styles: `
    .stat-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      border: 1px solid #e2e8f0;
      box-shadow: none;
    }

    .stat-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;

      mat-icon {
        color: #ffffff;
      }
    }

    .stat-card__icon--blue {
      background: #2563eb;
    }

    .stat-card__icon--amber {
      background: #d97706;
    }

    .stat-card__icon--green {
      background: #16a34a;
    }

    .stat-card__icon--slate {
      background: #475569;
    }

    .stat-card__content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-card__value {
      font-size: 1.75rem;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.2;
    }

    .stat-card__label {
      font-size: 0.875rem;
      color: #64748b;
    }
  `,
})
export class DashboardStatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly icon = input.required<string>();
  readonly color = input<'blue' | 'amber' | 'green' | 'slate'>('blue');
}
