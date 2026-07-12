import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AUTH_RATE_LIMITER } from '../src/auth/auth-rate-limiter';
import { AUTH_REPOSITORY } from '../src/auth/auth.repository';
import { TokenService } from '../src/auth/token.service';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/api-response.interceptor';
import { HabitModule } from '../src/habits/habit.module';
import { HABIT_REPOSITORY, type HabitRepository } from '../src/habits/habit.repository';
import type { HabitProgressView, HabitView } from '../src/habits/habit.types';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { SubscriptionService } from '../src/subscription/subscription.service';

describe('habits API', () => {
  let app: NestFastifyApplication;
  let authorization: string;
  const habits: Array<HabitView & { userId: string }> = [];
  const progress: HabitProgressView[] = [];
  const repository: HabitRepository = {
    async list(userId) { return habits.filter((habit) => habit.userId === userId); },
    async create(userId, input) {
      const habit = { ...input, id: randomUUID(), userId, status: 'active' as const, version: 1, todayMinutes: 0, updatedAt: new Date() };
      habits.push(habit); return habit;
    },
    async update() { return { status: 'not-found' }; },
    async archive() { return { status: 'not-found' }; },
    async addProgress(input) {
      const habit = habits.find((item) => item.userId === input.userId && item.id === input.habitId);
      if (!habit) return { status: 'not-found' };
      const entry = { id: randomUUID(), habitId: habit.id, minutes: input.minutes, progressDate: input.date, createdAt: new Date() };
      progress.push(entry); habit.todayMinutes += input.minutes;
      return { status: 'ok', value: entry };
    },
    async listProgress(userId, habitId) {
      return habits.some((habit) => habit.userId === userId && habit.id === habitId)
        ? { status: 'ok', value: progress.filter((entry) => entry.habitId === habitId) }
        : { status: 'not-found' };
    },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true, load: [() => ({
      JWT_ACCESS_SECRET: 'access-secret-with-more-than-32-characters', JWT_REFRESH_SECRET: 'refresh-secret-with-more-than-32-characters',
      JWT_ACCESS_TTL_SECONDS: 900, JWT_REFRESH_TTL_SECONDS: 2592000,
    })] }), HabitModule] })
      .overrideProvider(AUTH_REPOSITORY).useValue({})
      .overrideProvider(AUTH_RATE_LIMITER).useValue({ consume: async () => undefined })
      .overrideProvider(PrismaService).useValue({})
      .overrideProvider(SubscriptionService).useValue({ assertCanCreateHabit: async () => undefined })
      .overrideProvider(HABIT_REPOSITORY).useValue(repository).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ApiExceptionFilter()); app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init(); await app.getHttpAdapter().getInstance().ready();
    authorization = `Bearer ${(await module.get(TokenService).issue('user-one', 'device-one')).accessToken}`;
  });
  afterAll(async () => app.close());

  test('creates a constrained habit and records progress', async () => {
    const created = await app.inject({ method: 'POST', url: '/habits', headers: { authorization },
      payload: { name: '晨读', targetMinutes: 30, forceEnabled: true, triggerTime: '07:30' } });
    expect(created.statusCode).toBe(201);
    const habit = created.json().data;
    const recorded = await app.inject({ method: 'POST', url: `/habits/${habit.id}/progress`,
      headers: { authorization, 'idempotency-key': 'habit-progress-key-001' }, payload: { minutes: 20, date: '2026-07-11' } });
    expect(recorded.statusCode).toBe(201);
    const listed = await app.inject({ method: 'GET', url: '/habits?date=2026-07-11', headers: { authorization } });
    expect(listed.json().data[0]).toMatchObject({ name: '晨读', todayMinutes: 20, triggerTime: '07:30' });
  });

  test('rejects force constraint without trigger time', async () => {
    const response = await app.inject({ method: 'POST', url: '/habits', headers: { authorization },
      payload: { name: '晚间复盘', targetMinutes: 20, forceEnabled: true } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRIGGER_TIME_REQUIRED');
  });
});
