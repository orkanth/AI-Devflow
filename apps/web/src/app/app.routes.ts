import { Route } from '@angular/router';
import { AgentPromptPage } from './pages/agent-prompt/agent-prompt';
import { Shell } from './layout/shell';
import { ChatPage } from './pages/chat/chat';
import { DashboardPage } from './pages/dashboard/dashboard';
import { KnowledgePage } from './pages/knowledge/knowledge';
import { LearnPage } from './pages/learn/learn';
import { ProfilePage } from './pages/profile/profile';
import { ProjectsPage } from './pages/projects/projects';
import { TasksPage } from './pages/tasks/tasks';
import { TddUploadPage } from './pages/tdd-upload/tdd-upload';
import { UsersPage } from './pages/users/users';

export const appRoutes: Route[] = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', component: DashboardPage },
      { path: 'projects', component: ProjectsPage },
      { path: 'tdd-upload', component: TddUploadPage },
      { path: 'tasks', component: TasksPage },
      { path: 'agent-prompt', component: AgentPromptPage },
      { path: 'users', component: UsersPage },
      { path: 'profile', component: ProfilePage },
      { path: 'knowledge', component: KnowledgePage },
      { path: 'chat', component: ChatPage },
      { path: 'learn', component: LearnPage },
    ],
  },
];
