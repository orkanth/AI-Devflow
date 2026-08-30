import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'df-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="shell">
      <aside class="nav">
        <div class="brand">
          <span class="mark">DF</span>
          <div>
            <strong>DevFlow AI</strong>
            <small>Nx monorepo prototype</small>
          </div>
        </div>
        <nav>
          @for (item of links; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/' }">
              {{ item.label }}
            </a>
          }
        </nav>
        <p class="hint">Angular → NestJS → FastAPI / pgvector</p>
      </aside>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 240px 1fr;
    }
    .nav {
      background: #0f172a;
      color: #e2e8f0;
      padding: 1.25rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .brand {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }
    .brand small {
      display: block;
      color: #94a3b8;
    }
    .mark {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.6rem;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #38bdf8, #6366f1);
      font-weight: 700;
    }
    nav {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    nav a {
      color: #cbd5e1;
      text-decoration: none;
      padding: 0.55rem 0.7rem;
      border-radius: 0.5rem;
    }
    nav a.active,
    nav a:hover {
      background: #1e293b;
      color: #fff;
    }
    .hint {
      margin-top: auto;
      font-size: 0.75rem;
      color: #64748b;
    }
    .content {
      padding: 1.5rem 2rem;
      background: #f8fafc;
    }
    @media (max-width: 800px) {
      .shell {
        grid-template-columns: 1fr;
      }
      .nav {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
      }
      .hint {
        display: none;
      }
    }
  `,
})
export class Shell {
  protected readonly links = [
    { path: '/', label: 'Dashboard' },
    { path: '/projects', label: 'Projects' },
    { path: '/tasks', label: 'Tasks' },
    { path: '/knowledge', label: 'Knowledge / RAG' },
    { path: '/chat', label: 'AI Console' },
    { path: '/learn', label: 'Interview notes' },
  ];
}
