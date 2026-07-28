import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { ScoringRepository } from './scoring.repository';
import type { DailyScoreView, ScoreEventView } from './scoring.types';

@Injectable()
export class PrismaScoringRepository implements ScoringRepository {
  constructor(private readonly prisma: PrismaService) {}

  getSession(userId: string, sessionId: string) {
    return this.prisma.focusSession.findFirst({ where: { id: sessionId, userId }, select: {
      id: true, userId: true, mode: true, timerMode: true, trustLevel: true, endedAt: true, actualMinutes: true,
      restrictionMode: true, whitelistSource: true, whitelistPackageCount: true,
      restrictionEffective: true, effectiveMinutes: true, outcome: true,
    } });
  }

  async listCompletedDates(userId: string, through: Date) {
    const sessions = await this.prisma.focusSession.findMany({ where: { userId, outcome: 'completed', endedAt: { not: null, lte: endOfDay(through) } },
      select: { endedAt: true }, orderBy: { endedAt: 'desc' } });
    return sessions.flatMap((session) => session.endedAt ? [dateOnly(session.endedAt)] : []);
  }

  async sumCompletedMinutesOnDate(userId: string, date: Date, excludeSessionId?: string) {
    const aggregate = await this.prisma.scoreEvent.aggregate({
      where: {
        userId,
        scoreDate: dateOnly(date),
        outcome: 'completed',
        ...(excludeSessionId ? { sessionId: { not: excludeSessionId } } : {}),
      },
      _sum: { durationMinutes: true },
    });
    return Math.max(0, aggregate._sum.durationMinutes ?? 0);
  }

  async lastPositiveStarDate(userId: string, before: Date) {
    const rows = await this.prisma.scoreEvent.groupBy({
      by: ['scoreDate'],
      where: { userId, scoreDate: { lte: dateOnly(before) }, totalScore: { gt: 0 } },
      _sum: { totalScore: true },
      orderBy: { scoreDate: 'desc' },
      take: 50,
    });
    const hit = rows.find((row) => (row._sum.totalScore ?? 0) > 0);
    return hit?.scoreDate ?? null;
  }

  async hasIdlePenaltyOnDate(userId: string, date: Date) {
    const key = idleKey(userId, date);
    const existing = await this.prisma.scoreEvent.findFirst({ where: { userId, streakAwardKey: key } });
    return Boolean(existing);
  }

  async createIdlePenaltyEvent(userId: string, date: Date, stars: number) {
    const scoreDate = dateOnly(date);
    const key = idleKey(userId, scoreDate);
    if (await this.hasIdlePenaltyOnDate(userId, scoreDate)) return null;
    const task = await this.prisma.task.findFirst({ where: { userId }, select: { id: true }, orderBy: { createdAt: 'asc' } });
    if (!task) return null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const session = await tx.focusSession.create({
          data: {
            userId,
            taskId: task.id,
            mode: 'focus',
            timerMode: 'countdown',
            trustLevel: 'normal',
            startedAt: scoreDate,
            endedAt: scoreDate,
            plannedMinutes: 0,
            actualMinutes: 0,
            outcome: 'failed',
            failureReasonType: 'idle_star_penalty',
            failureReasonText: '连续多日无记星专注',
            startIdempotencyKey: key,
            finishIdempotencyKey: `${key}:finish`,
          },
        });
        const event = await tx.scoreEvent.create({
          data: {
            userId,
            sessionId: session.id,
            scoreDate,
            outcome: 'failed',
            trustLevel: 'normal',
            durationMinutes: 0,
            streakDays: 0,
            durationScore: 0,
            streakScore: 0,
            trustScore: 0,
            penaltyScore: stars,
            totalScore: stars,
            formulaVersion: 'v2-stars-idle',
            streakAwardKey: key,
          },
        });
        return view(event);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
      throw error;
    }
  }

  async createEvent(input: Omit<ScoreEventView, 'id'> & { userId: string }) {
    const streakAwardKey = input.outcome === 'completed' && input.streakScore > 0 ? `${input.userId}:${input.scoreDate.toISOString().slice(0, 10)}` : null;
    try {
      return view(await this.prisma.scoreEvent.create({ data: { ...input, streakAwardKey } }));
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const existing = await this.prisma.scoreEvent.findUnique({ where: { sessionId: input.sessionId } });
      if (existing) return view(existing);
      return view(await this.prisma.scoreEvent.create({ data: { ...input, streakScore: 0,
        totalScore: input.totalScore - input.streakScore, streakAwardKey: null } }));
    }
  }

  async getToday(userId: string, date: Date) {
    const events = await this.prisma.scoreEvent.findMany({ where: { userId, scoreDate: dateOnly(date) } });
    return summarize(dateOnly(date), events);
  }

  async getHistory(userId: string, page: number, pageSize: number) {
    const dates = await this.prisma.scoreEvent.groupBy({ by: ['scoreDate'], where: { userId }, orderBy: { scoreDate: 'desc' },
      skip: (page - 1) * pageSize, take: pageSize });
    const totalRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(DISTINCT score_date) AS count FROM score_events WHERE user_id = ${userId}::uuid`;
    const events = dates.length ? await this.prisma.scoreEvent.findMany({ where: { userId, scoreDate: { in: dates.map((item) => item.scoreDate) } } }) : [];
    return { items: dates.map((item) => summarize(item.scoreDate, events.filter((event) => event.scoreDate.getTime() === item.scoreDate.getTime()))),
      total: Number(totalRows[0]?.count ?? 0) };
  }

  async listRecentEvents(userId: string, limit: number) {
    const events = await this.prisma.scoreEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(50, limit)),
    });
    return events.map(view);
  }
}

function idleKey(userId: string, date: Date) {
  return `idle-penalty:${userId}:${dateOnly(date).toISOString().slice(0, 10)}`;
}

function summarize(date: Date, events: Array<{ outcome: string; durationMinutes: number; streakDays: number; durationScore: number; streakScore: number; trustScore: number; penaltyScore: number; totalScore: number }>): DailyScoreView {
  return events.reduce<DailyScoreView>((total, event) => ({ ...total,
    focusMinutes: total.focusMinutes + (event.outcome === 'completed' ? event.durationMinutes : 0),
    completedSessions: total.completedSessions + (event.outcome === 'completed' ? 1 : 0),
    failedSessions: total.failedSessions + (event.outcome === 'completed' ? 0 : 1),
    streakDays: Math.max(total.streakDays, event.streakDays),
    durationScore: total.durationScore + event.durationScore, streakScore: total.streakScore + event.streakScore,
    trustScore: total.trustScore + event.trustScore, penaltyScore: total.penaltyScore + event.penaltyScore,
    totalScore: total.totalScore + event.totalScore,
  }), { date, focusMinutes: 0, completedSessions: 0, failedSessions: 0, streakDays: 0, durationScore: 0, streakScore: 0, trustScore: 0, penaltyScore: 0, totalScore: 0 });
}
function view(event: { id: string; sessionId: string; scoreDate: Date; outcome: ScoreEventView['outcome']; trustLevel: ScoreEventView['trustLevel']; durationMinutes: number; streakDays: number; durationScore: number; streakScore: number; trustScore: number; penaltyScore: number; totalScore: number; formulaVersion: string }): ScoreEventView { return event; }
function dateOnly(value: Date) { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())); }
function endOfDay(value: Date) { const date = dateOnly(value); return new Date(date.getTime() + 86_400_000 - 1); }
