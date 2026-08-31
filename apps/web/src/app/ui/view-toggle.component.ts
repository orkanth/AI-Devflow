import { Component, model } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'df-view-toggle',
  imports: [MatButtonToggleModule, MatIconModule],
  template: `
    <mat-button-toggle-group
      [value]="view()"
      (change)="view.set($event.value)"
      hideSingleSelectionIndicator
    >
      <mat-button-toggle value="list" aria-label="List view">
        <mat-icon>view_list</mat-icon>
        List
      </mat-button-toggle>
      <mat-button-toggle value="grid" aria-label="Grid board">
        <mat-icon>view_column</mat-icon>
        Grid
      </mat-button-toggle>
    </mat-button-toggle-group>
  `,
  styles: `
    mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 4px;
    }
  `,
})
export class ViewToggleComponent {
  readonly view = model<'list' | 'grid'>('grid');
}
