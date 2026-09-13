import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
}

@Component({
  selector: 'df-shell-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatListModule,
    MatIconModule,
    MatTooltipModule,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './shell-sidebar.component.html',
  styleUrl: './shell-sidebar.component.scss',
})
export class ShellSidebarComponent {
  readonly collapsed = input(false);

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/', icon: 'dashboard', exact: true },
    { label: 'Projects', route: '/projects', icon: 'folder' },
    { label: 'Tasks', route: '/tasks', icon: 'assignment' },
    { label: 'Users', route: '/users', icon: 'group' },
    { label: 'Profile', route: '/profile', icon: 'person' },
    { label: 'Knowledge / RAG', route: '/knowledge', icon: 'auto_stories' },
    { label: 'AI Console', route: '/chat', icon: 'smart_toy' },
    { label: 'Interview notes', route: '/learn', icon: 'school' },
  ];
}
