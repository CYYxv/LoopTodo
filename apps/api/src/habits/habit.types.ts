export type HabitView = {
  id: string;
  name: string;
  targetMinutes: number;
  forceEnabled: boolean;
  triggerTime: string | null;
  status: 'active' | 'archived';
  version: number;
  todayMinutes: number;
  updatedAt: Date;
};

export type HabitProgressView = {
  id: string;
  habitId: string;
  minutes: number;
  progressDate: Date;
  createdAt: Date;
};
