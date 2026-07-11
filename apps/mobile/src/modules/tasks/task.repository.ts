import type { FocusSessionRecord } from '@/modules/focus-session/focus-session.types';

import type { CreateTaskInput, Task } from './task.types';

export interface TaskRepository {
  list(): Promise<Task[]>;
  create(input: CreateTaskInput): Promise<Task>;
  save(task: Task): Promise<void>;
  finishSession(task: Task, record: FocusSessionRecord): Promise<void>;
}
