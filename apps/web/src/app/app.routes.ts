import { Route } from '@angular/router';
import { Shell } from './layout/shell';
import { DashboardPage } from './pages/dashboard.page';
import { ProjectsPage } from './pages/projects.page';
import { TasksPage } from './pages/tasks.page';
import { KnowledgePage } from './pages/knowledge.page';
import { ChatPage } from './pages/chat.page';
import { LearnPage } from './pages/learn.page';

export const appRoutes: Route[] = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', component: DashboardPage },
      { path: 'projects', component: ProjectsPage },
      { path: 'tasks', component: TasksPage },
      { path: 'knowledge', component: KnowledgePage },
      { path: 'chat', component: ChatPage },
      { path: 'learn', component: LearnPage },
    ],
  },
];
