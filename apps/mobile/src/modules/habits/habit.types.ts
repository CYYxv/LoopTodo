export type Habit = {
  id: string;
  name: string;
  targetMinutes: number;
  todayMinutes: number;
  forceEnabled: boolean;
  triggerTime: string | null;
  status: 'active' | 'archived';
};

export type CreateHabitInput = Omit<Habit, 'id' | 'todayMinutes' | 'status'>;
export type UpdateHabitInput = CreateHabitInput;
export type HabitProgressDay = { date: string; minutes: number };
