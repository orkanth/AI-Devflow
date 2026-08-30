import { TasksService } from '../tasks/tasks.service';
import { MemoryStore } from './memory.store';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';

describe('MemoryStore analytics', () => {
  it('counts seeded domain objects', () => {
    const store = new MemoryStore();
    const stats = store.analytics();
    expect(stats.users).toBe(2);
    expect(stats.projects).toBe(2);
    expect(stats.tasks).toBe(4);
    expect(stats.knowledgeChunks).toBe(4);
  });

  it('creates tasks through the service', () => {
    const store = new MemoryStore();
    const users = new UsersService(store);
    const projects = new ProjectsService(store, users);
    const tasks = new TasksService(store, projects);
    const created = tasks.create({
      projectId: store.projects[0].id,
      title: 'Write interview notes',
      description: 'Cover supervisor vs worker agents',
    });
    expect(created.status).toBe('todo');
    expect(store.tasks).toHaveLength(5);
  });

  it('deletes tasks and unassigns users', () => {
    const store = new MemoryStore();
    const users = new UsersService(store);
    const projects = new ProjectsService(store, users);
    const tasks = new TasksService(store, projects);
    const taskId = store.tasks[0].id;
    tasks.remove(taskId);
    expect(store.tasks.find((task) => task.id === taskId)).toBeUndefined();
    const removedUser = users.remove(store.users[0].id);
    expect(removedUser.deleted).toBe(true);
    expect(store.users).toHaveLength(1);
  });
});
