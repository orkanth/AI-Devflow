import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Injector,
  OnInit,
  afterNextRender,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatSidenav, MatSidenavContainer, MatSidenavModule } from '@angular/material/sidenav';
import { ShellHeaderComponent } from './shell-header.component';
import { ShellSidebarComponent } from './shell-sidebar.component';

@Component({
  selector: 'df-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSidenavModule,
    RouterOutlet,
    ShellHeaderComponent,
    ShellSidebarComponent,
  ],
  templateUrl: './shell-layout.component.html',
  styleUrl: './shell-layout.component.scss',
})
export class Shell implements OnInit {
  private readonly breakpoint = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly sidenav = viewChild(MatSidenav);
  private readonly sidenavContainer = viewChild(MatSidenavContainer);

  readonly isMobile = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly sidenavMode = signal<'side' | 'over'>('side');
  readonly sidenavOpened = signal(true);

  readonly sidenavWidth = () =>
    this.sidebarCollapsed() && !this.isMobile() ? 72 : 260;

  ngOnInit(): void {
    this.breakpoint
      .observe(['(max-width: 768px)'])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        const mobile = state.matches;
        this.isMobile.set(mobile);
        this.sidenavMode.set(mobile ? 'over' : 'side');

        if (!mobile) {
          this.sidenavOpened.set(true);
          const nav = this.sidenav();
          if (nav && !nav.opened) {
            nav.open();
          }
        }
      });
  }

  toggleSidenav(): void {
    if (this.isMobile()) {
      const nav = this.sidenav();
      if (nav) {
        nav.toggle();
        this.sidenavOpened.set(nav.opened);
      }
      return;
    }

    this.sidebarCollapsed.update((collapsed) => !collapsed);
    this.syncContentMargins();
  }

  private syncContentMargins(): void {
    afterNextRender(
      () => {
        const container = this.sidenavContainer();
        if (container) {
          container.updateContentMargins();
        }
        setTimeout(() => {
          const containerAfterTransition = this.sidenavContainer();
          if (containerAfterTransition) {
            containerAfterTransition.updateContentMargins();
          }
        }, 220);
      },
      { injector: this.injector }
    );
  }

  onSidenavClosed(): void {
    this.sidenavOpened.set(false);
  }

  onSidenavOpened(): void {
    this.sidenavOpened.set(true);
  }
}
