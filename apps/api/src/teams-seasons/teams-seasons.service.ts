import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { EventBusService } from '../common/event-bus.module';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';
import { demoteTier, teamScore, tierForScore, tierNames } from './ranking.policy';

@Injectable()
export class TeamsSeasonsService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly config: ConfigService, private readonly events: EventBusService) {}
  private readonly logger = new Logger(TeamsSeasonsService.name);
  private readonly scoreListener = (userId: string) => { void this.attachCurrentScores(userId).catch((error) => this.logger.error('Failed to attach score event to season', error)); };
  onModuleInit() { this.events.on('score.settled', this.scoreListener); }
  onModuleDestroy() { this.events.off('score.settled', this.scoreListener); }

  async currentSeason() {
    await this.settleExpiredSeasons(); const range = seasonRange(new Date());
    const season = await this.prisma.season.upsert({ where: { startsAt: range.startsAt }, update: {}, create: { name: range.name, startsAt: range.startsAt, endsAt: range.endsAt } });
    await this.prisma.scoreEvent.updateMany({ where: { seasonId: null, scoreDate: { gte: dateOnly(season.startsAt), lt: dateOnly(season.endsAt) } }, data: { seasonId: season.id } });
    return season;
  }

  async currentRank(userId: string) {
    const season = await this.currentSeason(); await this.attachCurrentScores(userId, season);
    const aggregate = await this.prisma.scoreEvent.aggregate({ where: { userId, seasonId: season.id }, _sum: { totalScore: true } }); const score = aggregate._sum.totalScore ?? 0;
    const previous = await this.prisma.rankSnapshot.findFirst({ where: { userId, season: { endsAt: { lte: season.startsAt } } }, orderBy: { season: { endsAt: 'desc' } } });
    const earned = tierForScore(score, this.thresholds()); const starting = previous ? demoteTier(previous.tier) : tierNames[0];
    const tier = tierNames[Math.max(tierNames.indexOf(earned), tierNames.indexOf(starting))]!;
    return { season, score, tier, startingTier: starting, nextThreshold: this.thresholds()[tierNames.indexOf(tier) + 1] ?? null };
  }

  async leaderboard(period: 'today' | 'week' | 'month' | 'season', limit: number) {
    const season = await this.currentSeason(); const range = leaderboardRange(period, season);
    const cacheKey = `leaderboard:${period}:${range.start.toISOString()}:${limit}`; const redis = await this.redis.getClient(); const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    const rows = await this.prisma.scoreEvent.groupBy({ by: ['userId'], where: { scoreDate: { gte: range.start, lt: range.end }, user: { socialEnabled: true } }, _sum: { totalScore: true, durationMinutes: true }, orderBy: { _sum: { totalScore: 'desc' } }, take: limit });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((row) => row.userId) } }, select: { id: true, nickname: true, avatarUrl: true } }); const byId = new Map(users.map((user) => [user.id, user]));
    const result = rows.map((row, index) => ({ position: index + 1, user: byId.get(row.userId), score: row._sum.totalScore ?? 0, focusMinutes: row._sum.durationMinutes ?? 0 }));
    await redis.set(cacheKey, JSON.stringify(result), 'EX', period === 'today' ? 15 : 60); return result;
  }

  async createTeam(userId: string, name: string) {
    await this.ensureSocialEnabled(userId);
    try { return await this.prisma.$transaction(async (transaction) => { if (await transaction.teamMember.findUnique({ where: { userId } })) throw new ConflictException({ code: 'TEAM_MEMBERSHIP_EXISTS', message: '每个用户只能加入一个战队' });
      const team = await transaction.team.create({ data: { leaderId: userId, name: name.trim(), joinCode: randomBytes(5).toString('hex').toUpperCase(), memberCount: 1 } });
      await transaction.teamMember.create({ data: { teamId: team.id, userId, role: 'leader' } }); return team; }); }
    catch (error) { if (error instanceof ConflictException) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ code: 'TEAM_EXISTS', message: '战队名称已存在或用户已有战队' }); throw error; }
  }

  async joinTeam(userId: string, joinCode: string) {
    await this.ensureSocialEnabled(userId);
    return this.prisma.$transaction(async (transaction) => {
      if (await transaction.teamMember.findUnique({ where: { userId } })) throw new ConflictException({ code: 'TEAM_MEMBERSHIP_EXISTS', message: '每个用户只能加入一个战队' });
      const team = await transaction.team.findUnique({ where: { joinCode: joinCode.trim().toUpperCase() } }); if (!team) throw new NotFoundException({ code: 'TEAM_NOT_FOUND', message: '战队邀请码无效' });
      const reserved = await transaction.team.updateMany({ where: { id: team.id, memberCount: { lt: 10_000 } }, data: { memberCount: { increment: 1 } } });
      if (!reserved.count) throw new ConflictException({ code: 'TEAM_FULL', message: '战队人数已达 10000 人上限' });
      return transaction.teamMember.create({ data: { teamId: team.id, userId } });
    });
  }

  async myTeam(userId: string) { return this.prisma.teamMember.findUnique({ where: { userId }, include: { team: true } }); }

  async teamLeaderboard(limit: number) {
    const season = await this.currentSeason();
    const teams = await this.prisma.$queryRaw<Array<{ id: string; name: string; member_count: number; total_score: bigint }>>`
      SELECT t.id, t.name, t.member_count, COALESCE(SUM(se.total_score), 0)::bigint AS total_score
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id = t.id
      LEFT JOIN score_events se ON se.user_id = tm.user_id AND se.season_id = ${season.id}::uuid
      GROUP BY t.id, t.name, t.member_count`;
    const averageWeight = this.config.get<number>('TEAM_AVERAGE_WEIGHT') ?? 0.7; const totalWeight = this.config.get<number>('TEAM_TOTAL_BONUS_WEIGHT') ?? 0.3;
    return teams.map((team) => { const total = Number(team.total_score); return { id: team.id, name: team.name, memberCount: team.member_count, totalScore: total,
      score: teamScore(total, team.member_count, averageWeight, totalWeight) }; }).sort((first, second) => second.score - first.score).slice(0, limit).map((team, index) => ({ ...team, position: index + 1 }));
  }

  private thresholds() { return JSON.parse(this.config.get<string>('RANK_THRESHOLDS_JSON') ?? '[0,500,1500,3000,5000,8000]') as number[]; }
  private async ensureSocialEnabled(userId: string) { const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { socialEnabled: true } }); if (!user?.socialEnabled) throw new ForbiddenException({ code: 'SOCIAL_DISABLED', message: '社交与竞技功能已关闭' }); }
  private async attachCurrentScores(userId: string, season?: Awaited<ReturnType<TeamsSeasonsService['currentSeason']>>) { const current = season ?? await this.currentSeason(); await this.prisma.scoreEvent.updateMany({ where: { userId, seasonId: null, scoreDate: { gte: dateOnly(current.startsAt), lt: dateOnly(current.endsAt) } }, data: { seasonId: current.id } }); }
  private async settleExpiredSeasons() { const expired = await this.prisma.season.findMany({ where: { status: 'active', endsAt: { lte: new Date() } } }); for (const season of expired) { await this.prisma.scoreEvent.updateMany({ where: { seasonId: null, scoreDate: { gte: dateOnly(season.startsAt), lt: dateOnly(season.endsAt) } }, data: { seasonId: season.id } });
      const scores = await this.prisma.scoreEvent.groupBy({ by: ['userId'], where: { seasonId: season.id }, _sum: { totalScore: true }, orderBy: { _sum: { totalScore: 'desc' } } });
      await this.prisma.$transaction([this.prisma.rankSnapshot.createMany({ data: scores.map((row, index) => ({ seasonId: season.id, userId: row.userId, score: row._sum.totalScore ?? 0, tier: tierForScore(row._sum.totalScore ?? 0, this.thresholds()), position: index + 1 })), skipDuplicates: true }), this.prisma.season.update({ where: { id: season.id }, data: { status: 'settled' } })]); } }
}

function seasonRange(now: Date) { const year = now.getUTCFullYear(); const half = now.getUTCMonth() < 6 ? 0 : 6; const startsAt = new Date(Date.UTC(year, half, 1)); const endsAt = new Date(Date.UTC(half === 0 ? year : year + 1, half === 0 ? 6 : 0, 1)); return { startsAt, endsAt, name: `${year}-S${half === 0 ? 1 : 2}` }; }
function dateOnly(value: Date) { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())); }
function leaderboardRange(period: string, season: { startsAt: Date; endsAt: Date }) { const now = new Date(); if (period === 'season') return { start: dateOnly(season.startsAt), end: dateOnly(season.endsAt) }; const start = dateOnly(now);
  if (period === 'week') start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7)); if (period === 'month') start.setUTCDate(1); return { start, end: period === 'today' ? new Date(start.getTime() + 86_400_000) : new Date() }; }
