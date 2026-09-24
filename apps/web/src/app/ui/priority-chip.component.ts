import { Component, input } from '@angular/core';

@Component({
  selector: 'df-priority-chip',
  template: `
    <span class="chip" [class]="'chip-' + (priority() || 'medium')">
      {{ label() }}
    </span>
  `,
  styles: `
    .chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 2px 10px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: capitalize;
    }
    .chip-high {
      color: #991b1b;
      background: #fee2e2;
    }
    .chip-medium {
      color: #92400e;
      background: #fef3c7;
    }
    .chip-low {
      color: #1d4ed8;
      background: #dbeafe;
    }
  `,
})
export class PriorityChipComponent {
  readonly priority = input('medium');

  label(): string {
    return this.priority() || 'medium';
  }
}
