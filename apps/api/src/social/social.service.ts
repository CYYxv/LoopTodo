import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';
import { socialPairKey } from './social.policy';

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  async inviteFriend(userId: string, email: string) {
    const [self, addressee] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { socialEnabled: true } }),
      this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, socialEnabled: true } }),
    ]);
    if (!self?.socialEnabled) throw socialDisabled();
    if (!addressee || addressee.id === userId) throw new NotFoundException({ code: 'FRIEND_NOT_FOUND', message: '未找到可邀请用户' });
    if (!addressee.socialEnabled) throw new ForbiddenException({ code: 'FRIEND_SOCIAL_DISABLED', message: '对方已关闭社交功能' });
    try {
      return await this.prisma.friendship.create({ data: { requesterId: userId, addresseeId: addressee.id, pairKey: socialPairKey(userId, addressee.id) } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      throw new ConflictException({ code: 'FRIENDSHIP_EXISTS', message: '好友关系或邀请已存在' });
    }
  }

  async acceptFriend(userId: string, friendshipId: string) {
    const updated = await this.prisma.friendship.updateMany({ where: { id: friendshipId, addresseeId: userId, status: 'pending' }, data: { status: 'accepted', respondedAt: new Date() } });
    if (!updated.count) throw new NotFoundException({ code: 'FRIEND_INVITE_NOT_FOUND', message: '好友邀请不存在或已处理' });
    return this.prisma.friendship.findUniqueOrThrow({ where: { id: friendshipId } });
  }

  async listFriends(userId: string) {
    const rows = await this.prisma.friendship.findMany({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: { requester: { select: { id: true, nickname: true, avatarUrl: true } }, addressee: { select: { id: true, nickname: true, avatarUrl: true } } }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({ id: row.id, status: row.status, direction: row.requesterId === userId ? 'outgoing' : 'incoming',
      user: row.requesterId === userId ? row.addressee : row.requester, createdAt: row.createdAt }));
  }

  async createPkMatch(userId: string, friendUserId: string) {
    if (!(await this.areFriends(userId, friendUserId))) throw new ForbiddenException({ code: 'PK_FRIEND_REQUIRED', message: '只能向已接受的好友发起 PK' });
    const matchDate = dateOnly(new Date()); const key = `${matchDate.toISOString().slice(0, 10)}:${socialPairKey(userId, friendUserId)}`;
    try { return await this.prisma.pkMatch.create({ data: { challengerId: userId, opponentId: friendUserId, matchDate, pairDateKey: key } }); }
    catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      throw new ConflictException({ code: 'PK_ALREADY_EXISTS', message: '今天已与该好友创建 PK' }); }
  }

  async listTodayPk(userId: string) {
    const date = dateOnly(new Date()); const matches = await this.prisma.pkMatch.findMany({ where: { matchDate: date, OR: [{ challengerId: userId }, { opponentId: userId }] },
      include: { challenger: { select: { id: true, nickname: true } }, opponent: { select: { id: true, nickname: true } } } });
    return Promise.all(matches.map((match) => this.pkView(match)));
  }

  async getPkMatch(userId: string, matchId: string) {
    const match = await this.prisma.pkMatch.findFirst({ where: { id: matchId, OR: [{ challengerId: userId }, { opponentId: userId }] },
      include: { challenger: { select: { id: true, nickname: true } }, opponent: { select: { id: true, nickname: true } } } });
    if (!match) throw new NotFoundException({ code: 'PK_NOT_FOUND', message: 'PK 不存在' });
    return this.pkView(match);
  }

  async createRoom(userId: string, name: string, visibility: 'public' | 'private') {
    await this.ensureSocialEnabled(userId);
    return this.prisma.$transaction(async (transaction) => {
      const room = await transaction.studyRoom.create({ data: { ownerId: userId, name: name.trim(), visibility,
        inviteCode: visibility === 'private' ? randomBytes(5).toString('hex').toUpperCase() : null } });
      await transaction.studyRoomMember.create({ data: { roomId: room.id, userId } });
      return room;
    });
  }

  async joinRoom(userId: string, roomId?: string, inviteCode?: string) {
    if (!roomId && !inviteCode) throw new BadRequestException({ code: 'ROOM_REFERENCE_REQUIRED', message: '请提供公开房间 ID 或私密邀请码' });
    await this.ensureSocialEnabled(userId);
    const room = await this.prisma.studyRoom.findFirst({ where: inviteCode ? { inviteCode: inviteCode.trim().toUpperCase() } : { id: roomId, visibility: 'public' } });
    if (!room) throw new NotFoundException({ code: 'ROOM_NOT_FOUND', message: '自习室不存在或邀请码无效' });
    return this.prisma.studyRoomMember.upsert({ where: { roomId_userId: { roomId: room.id, userId } }, update: { leftAt: null, joinedAt: new Date() }, create: { roomId: room.id, userId } });
  }

  async listRooms(userId: string) {
    const rooms = await this.prisma.studyRoom.findMany({ where: { OR: [{ visibility: 'public' }, { members: { some: { userId, leftAt: null } } }] },
      include: { _count: { select: { members: { where: { leftAt: null } } } }, members: { where: { userId, leftAt: null }, select: { id: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rooms.map((room) => ({ id: room.id, name: room.name, visibility: room.visibility, inviteCode: room.ownerId === userId ? room.inviteCode : null,
      memberCount: room._count.members, joined: room.members.length > 0 }));
  }

  async ensureRoomMember(userId: string, roomId: string) {
    const member = await this.prisma.studyRoomMember.findFirst({ where: { roomId, userId, leftAt: null } });
    if (!member) throw new ForbiddenException({ code: 'ROOM_MEMBERSHIP_REQUIRED', message: '请先加入自习室' });
  }

  async sendReaction(userId: string, roomId: string, emoji: string) {
    await this.ensureRoomMember(userId, roomId);
    const redis = await this.redis.getClient(); const allowed = await redis.set(`social:reaction:${userId}`, '1', 'EX', 1, 'NX');
    if (!allowed) throw new ConflictException({ code: 'REACTION_RATE_LIMITED', message: '表情发送过快' });
    return this.prisma.studyRoomReaction.create({ data: { roomId, userId, emoji }, include: { user: { select: { nickname: true } } } });
  }

  private async areFriends(first: string, second: string) { return Boolean(await this.prisma.friendship.findFirst({ where: { pairKey: socialPairKey(first, second), status: 'accepted' } })); }
  private async ensureSocialEnabled(userId: string) { const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { socialEnabled: true } }); if (!user?.socialEnabled) throw socialDisabled(); }
  private async pkView(match: { id: string; challengerId: string; opponentId: string; matchDate: Date; status: string; challenger: { id: string; nickname: string }; opponent: { id: string; nickname: string } }) {
    const events = await this.prisma.scoreEvent.groupBy({ by: ['userId'], where: { userId: { in: [match.challengerId, match.opponentId] }, scoreDate: match.matchDate, outcome: 'completed' }, _sum: { durationMinutes: true } });
    const minutes = new Map(events.map((event) => [event.userId, event._sum.durationMinutes ?? 0]));
    return { id: match.id, status: match.status, date: match.matchDate, challenger: { ...match.challenger, minutes: minutes.get(match.challengerId) ?? 0 },
      opponent: { ...match.opponent, minutes: minutes.get(match.opponentId) ?? 0 } };
  }
}

function dateOnly(value: Date) { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())); }
function socialDisabled() { return new ForbiddenException({ code: 'SOCIAL_DISABLED', message: '社交功能已关闭' }); }
