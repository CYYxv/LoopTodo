import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../infrastructure/prisma/prisma.service';

import { EmailAlreadyExistsError, type AuthRepository } from './auth.repository';
import type { AuthUser, BottomTabKey, DeviceSession } from './auth.types';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } }) as Promise<AuthUser | null>;
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } }) as Promise<AuthUser | null>;
  }

  async createUserWithSession(input: Parameters<AuthRepository['createUserWithSession']>[0]) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({ data: input.user });
        await transaction.deviceSession.create({
          data: { ...input.session, userId: user.id },
        });
        return user as AuthUser;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }

  async createSession(input: Parameters<AuthRepository['createSession']>[0]) {
    await this.prisma.deviceSession.create({ data: input });
  }

  async findSession(id: string) {
    return this.prisma.deviceSession.findUnique({ where: { id } }) as Promise<DeviceSession | null>;
  }

  async rotateSession(id: string, currentHash: string, nextHash: string, expiresAt: Date) {
    const result = await this.prisma.deviceSession.updateMany({
      where: { id, refreshTokenHash: currentHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { refreshTokenHash: nextHash, expiresAt, lastUsedAt: new Date() },
    });
    return result.count === 1;
  }

  async revokeSession(id: string, userId: string) {
    await this.prisma.deviceSession.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async updateSettings(userId: string, input: { multiDeviceFocusSync?: boolean; privacySettings?: Record<string, unknown>; bottomTabs?: BottomTabKey[]; shareCurrentTask?: boolean; shareCompletedTasks?: boolean; networkPolicy?: 'offline_first' | 'online_required'; taskRemindersEnabled?: boolean; familyAlertsEnabled?: boolean; rewardNotificationsEnabled?: boolean }) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return null;
    return this.prisma.user.update({ where: { id: userId }, data: {
      multiDeviceFocusSync: input.multiDeviceFocusSync,
      privacySettings: input.privacySettings as Prisma.InputJsonValue | undefined,
      bottomTabs: input.bottomTabs, shareCurrentTask: input.shareCurrentTask, shareCompletedTasks: input.shareCompletedTasks,
      networkPolicy: input.networkPolicy, taskRemindersEnabled: input.taskRemindersEnabled,
      familyAlertsEnabled: input.familyAlertsEnabled, rewardNotificationsEnabled: input.rewardNotificationsEnabled,
    } }) as Promise<AuthUser>;
  }
}
