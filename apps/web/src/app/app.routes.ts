import { Route } from '@angular/router';
import { Shell } from './layout/shell'; 
import { TasksPage } from './pages/tasks.page'; 
import { ProfilePage } from './pages/profile.page';
import { KnowledgePage } from './pages/knowledge.page';
import { ChatPage } from './pages/chat.page';
import { LearnPage } from './pages/learn.page';
import { UsersPage } from './pages/users/users';
import { ProjectsPage } from './pages/projects/projects';
import { DashboardPage } from './pages/dashboard/dashboard';
import { TddUploadPage } from './pages/tdd-upload/tdd-upload';

export const appRoutes: Route[] = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', component: DashboardPage },
      { path: 'projects', component: ProjectsPage },
      { path: 'tdd-upload', component: TddUploadPage },
      { path: 'tasks', component: TasksPage },
      { path: 'users', component: UsersPage },
      { path: 'profile', component: ProfilePage },
      { path: 'knowledge', component: KnowledgePage },
      { path: 'chat', component: ChatPage },
      { path: 'learn', component: LearnPage },
    ],
  },
];
