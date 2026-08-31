import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  contentChild,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';

export interface StatusColumn {
  id: string;
  label: string;
}

@Component({
  selector: 'df-status-board',
  imports: [
    NgTemplateOutlet,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
  ],
  template: `
    <div class="board" cdkDropListGroup>
      @for (column of columns(); track column.id) {
        <section class="column">
          <header class="column-head">
            <h2>{{ column.label }}</h2>
            <span class="count">{{ itemsFor(column.id).length }}</span>
          </header>
          <div
            class="column-body"
            cdkDropList
            [id]="column.id"
            [cdkDropListData]="column.id"
            (cdkDropListDropped)="onDrop($event, column.id)"
          >
            @for (item of itemsFor(column.id); track item.id) {
              <article
                class="tile"
                [class]="priorityClass(item)"
                cdkDrag
                [cdkDragData]="item"
              >
                <div class="tile-placeholder" *cdkDragPlaceholder></div>
                <button class="grip" type="button" cdkDragHandle aria-label="Drag">
                  <span class="grip-dots"></span>
                </button>
                <div class="tile-body">
                  <ng-container
                    *ngTemplateOutlet="itemTpl(); context: { $implicit: item }"
                  />
                </div>
              </article>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .board {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      align-items: start;
      min-height: 420px;
    }
    .column {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      min-height: 400px;
      display: flex;
      flex-direction: column;
    }
    .column-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px 8px;
    }
    .column-head h2 {
      margin: 0;
      font-size: 0.8125rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #334155;
    }
    .count {
      background: #fff;
      border-radius: 999px;
      font-size: 0.75rem;
      padding: 2px 8px;
      color: #64748b;
    }
    .column-body {
      flex: 1;
      padding: 8px;
      min-height: 320px;
    }
    .tile {
      display: flex;
      gap: 4px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-left-width: 4px;
      border-radius: 10px;
      margin-bottom: 8px;
      cursor: grab;
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.06);
    }
    .tile.priority-high { border-left-color: #dc2626; }
    .tile.priority-medium { border-left-color: #d97706; }
    .tile.priority-low { border-left-color: #2563eb; }
    .grip {
      border: 0;
      background: transparent;
      padding: 10px 4px 10px 8px;
      cursor: grab;
      color: #94a3b8;
    }
    .grip-dots {
      display: block;
      width: 8px;
      height: 16px;
      background-image: radial-gradient(#94a3b8 1.2px, transparent 1.3px);
      background-size: 4px 4px;
    }
    .tile-body {
      flex: 1;
      padding: 10px 10px 10px 0;
      min-width: 0;
    }
    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 10px;
      box-shadow: 0 12px 24px rgb(15 23 42 / 0.18);
    }
    .tile-placeholder {
      min-height: 72px;
      border: 2px dashed #93c5fd;
      border-radius: 10px;
      margin-bottom: 8px;
      background: #eff6ff;
    }
    .cdk-drop-list-dragging .tile:not(.cdk-drag-placeholder) {
      transition: transform 150ms ease;
    }
  `,
})
export class StatusBoardComponent<T extends { id: string; status: string; priority?: string }> {
  readonly columns = input.required<StatusColumn[]>();
  readonly items = input.required<T[]>();
  readonly statusChange = output<{ item: T; status: string }>();
  readonly itemTpl = contentChild.required<TemplateRef<{ $implicit: T }>>(TemplateRef);

  itemsFor(status: string): T[] {
    return this.items().filter((item) => item.status === status);
  }

  priorityClass(item: T): string {
    const priority = item.priority ?? 'medium';
    return `priority-${priority}`;
  }

  onDrop(event: CdkDragDrop<string>, status: string): void {
    const item = event.item.data as T;
    if (!item || item.status === status) {
      return;
    }
    this.statusChange.emit({ item, status });
  }
}
