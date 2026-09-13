import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService, User } from './api.service';

const STORAGE_KEY = 'devflow-current-user-id';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiService);
  readonly users = signal<User[]>([]);
  readonly currentUserId = signal<string | null>(localStorage.getItem(STORAGE_KEY));
  readonly currentUser = computed((): User | null => {
    const id = this.currentUserId();
    return this.users().find((user) => user.id === id) ?? null;
  });

  load() {
    this.api.users().subscribe((users) => {
      this.users.set(users);
      const current = this.currentUserId();
      if (!current || !users.some((user) => user.id === current)) {
        this.setUser(users[0]?.id ?? null);
      }
    });
  }

  setUser(id: string | null) {
    this.currentUserId.set(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}
