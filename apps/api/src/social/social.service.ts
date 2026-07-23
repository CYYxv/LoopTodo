import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';
import { NotificationService } from '../notifications/notification.service';
import { competitiveFocusMinutes, socialPairKey } from './social.policy';

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly notifications: NotificationService) {}

  async inviteFriend(userId: string, email: string) {
    const addressee = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, nickname: true },
    });
    if (!addressee || addressee.id === userId) {
      throw new NotFoundException({ code: 'FRIEND_NOT_FOUND', message: '未找到可邀请用户' });
    }
    await this.assertNotBlocked(userId, addressee.id);
    const pairKey = socialPairKey(userId, addressee.id);
    const existing = await this.prisma.friendship.findUnique({ where: { pairKey } });
    if (existing?.status === 'blocked') {
      throw new ConflictException({ code: 'FRIENDSHIP_BLOCKED', message: '已被拉黑，无法邀请' });
    }
    if (existing) {
      throw new ConflictException({ code: 'FRIENDSHIP_EXISTS', message: '好友关系或邀请已存在' });
    }
    try {
      const friendship = await this.prisma.friendship.create({
        data: { requesterId: userId, addresseeId: addressee.id, pairKey },
      });
      const requester = await this.prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } });
      await this.enqueueFriendInviteNotification(
        addressee.id,
        userId,
        requester?.nickname ?? '好友',
        friendship.id,
        pairKey,
      );
      return friendship;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      throw new ConflictException({ code: 'FRIENDSHIP_EXISTS', message: '好友关系或邀请已存在' });
    }
  }

  async acceptFriend(userId: string, friendshipId: string) {
    const updated = await this.prisma.friendship.updateMany({
      where: { id: friendshipId, addresseeId: userId, status: 'pending' },
      data: { status: 'accepted', respondedAt: new Date() },
    });
    if (!updated.count) {
      throw new NotFoundException({ code: 'FRIEND_INVITE_NOT_FOUND', message: '好友邀请不存在或已处理' });
    }
    return this.prisma.friendship.findUniqueOrThrow({ where: { id: friendshipId } });
  }

  async removeFriend(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: { id: friendshipId, OR: [{ requesterId: userId }, { addresseeId: userId }] },
    });
    if (!friendship) throw new NotFoundException({ code: 'FRIENDSHIP_NOT_FOUND', message: '好友关系不存在' });
    if (friendship.status === 'blocked') {
      throw new ConflictException({ code: 'FRIENDSHIP_BLOCKED_IMMUTABLE', message: '已拉黑关系不能直接删除，避免绕过拉黑' });
    }
    await this.prisma.friendship.delete({ where: { id: friendshipId } });
    return { id: friendshipId, removed: true };
  }

  async blockFriend(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: { id: friendshipId, OR: [{ requesterId: userId }, { addresseeId: userId }] },
    });
    if (!friendship) throw new NotFoundException({ code: 'FRIENDSHIP_NOT_FOUND', message: '好友关系不存在' });
    const blockedId = friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId;
    await this.prisma.$transaction([
      this.prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: 'blocked', respondedAt: new Date() },
      }),
      this.prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: userId, blockedId } },
        create: { blockerId: userId, blockedId },
        update: {},
      }),
    ]);
    return this.prisma.friendship.findUniqueOrThrow({ where: { id: friendshipId } });
  }

  async reportUser(userId: string, targetUserId: string, reason: string) {
    if (userId === targetUserId) {
      throw new BadRequestException({ code: 'REPORT_SELF_FORBIDDEN', message: '不能举报自己' });
    }
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new BadRequestException({ code: 'REPORT_REASON_REQUIRED', message: '请填写举报原因' });
    }
    const finalReason = trimmed.slice(0, 500);
    return this.prisma.securityEvent.create({
      data: {
        actorId: userId,
        category: 'social',
        action: 'user_report',
        outcome: 'recorded',
        targetType: 'user',
        metadata: { targetUserId, reason: finalReason },
      },
    });
  }

  async listFriends(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: {
        requester: { select: { id: true, nickname: true, avatarUrl: true } },
        addressee: { select: { id: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      direction: row.requesterId === userId ? 'outgoing' : 'incoming',
      user: row.requesterId === userId ? row.addressee : row.requester,
      createdAt: row.createdAt,
    }));
  }

  async createPkMatch(userId: string, friendUserId: string) {
    await this.assertNotBlocked(userId, friendUserId);
    if (!(await this.areFriends(userId, friendUserId))) {
      throw new ForbiddenException({ code: 'PK_FRIEND_REQUIRED', message: '只能向已接受的好友发起 PK' });
    }
    const matchDate = dateOnly(new Date());
    const key = `${matchDate.toISOString().slice(0, 10)}:${socialPairKey(userId, friendUserId)}`;
    try {
      const match = await this.prisma.pkMatch.create({
        data: { challengerId: userId, opponentId: friendUserId, matchDate, pairDateKey: key },
      });
      const challenger = await this.prisma.user.findUnique({ where: { id: userId }, select: { nickname: true } });
      await this.enqueuePkStartedNotification(
        friendUserId,
        userId,
        challenger?.nickname ?? '好友',
        match.id,
        key,
      );
      return match;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      throw new ConflictException({ code: 'PK_ALREADY_EXISTS', message: '今天已与该好友创建 PK' });
    }
  }

  async listPkHistory(userId: string, limit = 30) {
    const take = Math.min(100, Math.max(1, limit));
    const matches = await this.prisma.pkMatch.findMany({
      where: { OR: [{ challengerId: userId }, { opponentId: userId }] },
      include: {
        challenger: { select: { id: true, nickname: true } },
        opponent: { select: { id: true, nickname: true } },
      },
      orderBy: [{ matchDate: 'desc' }, { createdAt: 'desc' }],
      take,
    });
    return Promise.all(matches.map((match) => this.pkView(match)));
  }

  async listTodayPk(userId: string) {
    const date = dateOnly(new Date());
    const matches = await this.prisma.pkMatch.findMany({
      where: { matchDate: date, OR: [{ challengerId: userId }, { opponentId: userId }] },
      include: {
        challenger: { select: { id: true, nickname: true } },
        opponent: { select: { id: true, nickname: true } },
      },
    });
    return Promise.all(matches.map((match) => this.pkView(match)));
  }

  async getPkMatch(userId: string, matchId: string) {
    const match = await this.prisma.pkMatch.findFirst({
      where: { id: matchId, OR: [{ challengerId: userId }, { opponentId: userId }] },
      include: {
        challenger: { select: { id: true, nickname: true } },
        opponent: { select: { id: true, nickname: true } },
      },
    });
    if (!match) throw new NotFoundException({ code: 'PK_NOT_FOUND', message: 'PK 不存在' });
    return this.pkView(match);
  }

  async createRoom(userId: string, name: string, visibility: 'public' | 'private') {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 15) {
      throw new BadRequestException({ code: 'ROOM_NAME_INVALID', message: '房间名称需为 1-15 个字' });
    }
    return this.prisma.$transaction(async (transaction) => {
      const room = await transaction.studyRoom.create({
        data: {
          ownerId: userId,
          name: trimmed,
          visibility,
          inviteCode: visibility === 'private' ? randomBytes(5).toString('hex').toUpperCase() : null,
        },
      });
      await transaction.studyRoomMember.create({ data: { roomId: room.id, userId } });
      return room;
    });
  }

  async joinRoom(userId: string, roomId?: string, inviteCode?: string) {
    if (!roomId && !inviteCode) {
      throw new BadRequestException({ code: 'ROOM_REFERENCE_REQUIRED', message: '请提供公开房间 ID 或私密邀请码' });
    }
    const room = await this.prisma.studyRoom.findFirst({
      where: inviteCode ? { inviteCode: inviteCode.trim().toUpperCase() } : { id: roomId, visibility: 'public' },
    });
    if (!room) throw new NotFoundException({ code: 'ROOM_NOT_FOUND', message: '自习室不存在或邀请码无效' });
    if (room.ownerId !== userId) await this.assertNotBlocked(userId, room.ownerId);
    return this.prisma.studyRoomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      update: { leftAt: null, joinedAt: new Date() },
      create: { roomId: room.id, userId },
    });
  }

  async listRooms(userId: string) {
    const rooms = await this.prisma.studyRoom.findMany({
      where: { OR: [{ visibility: 'public' }, { members: { some: { userId, leftAt: null } } }] },
      include: {
        _count: { select: { members: { where: { leftAt: null } } } },
        members: { where: { userId, leftAt: null }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
      visibility: room.visibility,
      inviteCode: room.ownerId === userId ? room.inviteCode : null,
      memberCount: room._count.members,
      joined: room.members.length > 0,
    }));
  }

  async ensureRoomMember(userId: string, roomId: string) {
    const member = await this.prisma.studyRoomMember.findFirst({ where: { roomId, userId, leftAt: null } });
    if (!member) throw new ForbiddenException({ code: 'ROOM_MEMBERSHIP_REQUIRED', message: '请先加入自习室' });
  }

  async sendReaction(userId: string, roomId: string, emoji: string) {
    await this.ensureRoomMember(userId, roomId);
    const redis = await this.redis.getClient();
    const allowed = await redis.set(`social:reaction:${userId}`, '1', 'EX', 1, 'NX');
    if (!allowed) throw new ConflictException({ code: 'REACTION_RATE_LIMITED', message: '表情发送过快' });
    return this.prisma.studyRoomReaction.create({
      data: { roomId, userId, emoji },
      include: { user: { select: { nickname: true } } },
    });
  }

  async sharedStatus(userId: string, targetUserId: string) {
    await this.assertNotBlocked(userId, targetUserId);
    const allowed =
      (await this.prisma.friendship.findFirst({
        where: { pairKey: socialPairKey(userId, targetUserId), status: 'accepted' },
      })) ||
      (await this.prisma.studyRoomMember.findFirst({
        where: {
          userId,
          leftAt: null,
          room: { members: { some: { userId: targetUserId, leftAt: null } } },
        },
      }));
    if (!allowed) throw new ForbiddenException({ code: 'SOCIAL_STATUS_FORBIDDEN', message: '无权查看该用户状态' });
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { nickname: true, shareCurrentTask: true, shareCompletedTasks: true },
    });
    if (!target) throw new NotFoundException({ code: 'SOCIAL_USER_NOT_FOUND', message: '用户不存在' });
    const today = dateOnly(new Date());
    const end = new Date(today.getTime() + 86_400_000);
    const current = target.shareCurrentTask
      ? await this.prisma.task.findFirst({
          where: { userId: targetUserId, activeSessionId: { not: null } },
          select: { id: true, title: true },
        })
      : null;
    const sessions = target.shareCompletedTasks
      ? await this.prisma.focusSession.findMany({
          where: { userId: targetUserId, outcome: 'completed', endedAt: { gte: today, lt: end } },
          include: { task: { select: { id: true, title: true } } },
        })
      : [];
    return {
      nickname: target.nickname,
      currentTask: current,
      completedTasks: [...new Map(sessions.map((item) => [item.task.id, item.task])).values()],
    };
  }

  private async assertNotBlocked(a: string, b: string) {
    const blocked = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    if (blocked) {
      throw new ForbiddenException({ code: 'USER_BLOCKED', message: '双方存在拉黑关系，无法继续该社交操作' });
    }
  }

  private async enqueueFriendInviteNotification(
    toUserId: string,
    fromUserId: string,
    fromNickname: string,
    friendshipId: string,
    pairKey: string,
  ) {
    await this.notifications.enqueue({
      userId: toUserId,
      type: 'friend_invite',
      title: '新的好友邀请',
      body: `${fromNickname} 邀请你成为好友`,
      data: { friendshipId, fromUserId },
      dedupeKey: `friend_invite:${pairKey}`,
      scheduledAt: new Date(),
    });
  }

  private async enqueuePkStartedNotification(toUserId: string, fromUserId: string, fromNickname: string, matchId: string, pairDateKey: string) {
    await this.notifications.enqueue({
      userId: toUserId,
      type: 'pk_started',
      title: '今日 PK 已开始',
      body: `${fromNickname} 向你发起了今日专注 PK`,
      data: { matchId, fromUserId },
      dedupeKey: `pk_started:${pairDateKey}:${toUserId}`,
      scheduledAt: new Date(),
    });
  }

  private async areFriends(first: string, second: string) {
    return Boolean(
      await this.prisma.friendship.findFirst({
        where: { pairKey: socialPairKey(first, second), status: 'accepted' },
      }),
    );
  }

  private async pkView(match: {
    id: string;
    challengerId: string;
    opponentId: string;
    matchDate: Date;
    status: string;
    challenger: { id: string; nickname: string };
    opponent: { id: string; nickname: string };
  }) {
    const events = await this.prisma.scoreEvent.findMany({
      where: {
        userId: { in: [match.challengerId, match.opponentId] },
        scoreDate: match.matchDate,
        outcome: 'completed',
      },
      select: { userId: true, durationMinutes: true, trustLevel: true },
    });
    const byUser = new Map<string, Array<{ durationMinutes: number; trustLevel: string }>>();
    for (const event of events) {
      const list = byUser.get(event.userId) ?? [];
      list.push(event);
      byUser.set(event.userId, list);
    }
    return {
      id: match.id,
      status: match.status,
      date: match.matchDate,
      challenger: { ...match.challenger, minutes: competitiveFocusMinutes(byUser.get(match.challengerId) ?? []) },
      opponent: { ...match.opponent, minutes: competitiveFocusMinutes(byUser.get(match.opponentId) ?? []) },
    };
  }
}

function dateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
