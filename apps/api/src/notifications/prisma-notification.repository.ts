import { Injectable } from '@nestjs/common';
import { Prisma, type NotificationDelivery } from '@prisma/client';

import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { NotificationRepository } from './notification.repository';
import { isNotificationTypeEnabled } from './notification.preference';
import type { DeliveryJob, NotificationEventInput } from './notification.types';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}
  async upsertDevice(input: Parameters<NotificationRepository['upsertDevice']>[0]) {
    const device = await this.prisma.device.upsert({ where: { userId_pushToken: { userId: input.userId, pushToken: input.pushToken } },
      create: input, update: { platform: input.platform, deviceName: input.deviceName, provider: input.provider,
        appVersion: input.appVersion, enabled: true, lastSeenAt: new Date() } });
    return { id: device.id };
  }
  async enqueue(input: NotificationEventInput) {
    const preferences = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { taskRemindersEnabled: true, familyAlertsEnabled: true, rewardNotificationsEnabled: true } });
    if (!isNotificationTypeEnabled(input.type, preferences)) return { eventId: 'suppressed', deliveries: 0, replayed: false };
    const existing = await this.prisma.notificationEvent.findUnique({ where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } }, include: { deliveries: true } });
    if (existing) return { eventId: existing.id, deliveries: existing.deliveries.length, replayed: true };
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const devices = await transaction.device.findMany({ where: { userId: input.userId, enabled: true } });
        const event = await transaction.notificationEvent.create({ data: input });
        if (devices.length) await transaction.notificationDelivery.createMany({ data: devices.map((device) => ({ eventId: event.id, deviceId: device.id, nextAttemptAt: input.scheduledAt })) });
        return { eventId: event.id, deliveries: devices.length, replayed: false };
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const replay = await this.prisma.notificationEvent.findUniqueOrThrow({ where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } }, include: { deliveries: true } });
      return { eventId: replay.id, deliveries: replay.deliveries.length, replayed: true };
    }
  }
  async claimDue(now: Date, limit: number): Promise<DeliveryJob[]> {
    const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<NotificationDelivery[]>`SELECT * FROM "notification_deliveries"
        WHERE ("status" = 'pending' AND "next_attempt_at" <= ${now})
          OR ("status" = 'processing' AND "updated_at" <= ${staleBefore})
        ORDER BY "next_attempt_at" ASC
        LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
      if (!rows.length) return [];
      await transaction.notificationDelivery.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { status: 'processing' } });
      const claimed = await transaction.notificationDelivery.findMany({ where: { id: { in: rows.map((row) => row.id) } }, include: { event: true, device: true } });
      return claimed.map((delivery) => ({ id: delivery.id, eventId: delivery.eventId, deviceId: delivery.deviceId,
        attempts: delivery.attempts, provider: delivery.device.provider, pushToken: delivery.device.pushToken,
        title: delivery.event.title, body: delivery.event.body, data: delivery.event.data as Record<string, string> }));
    });
  }
  async markDelivered(id: string, providerId: string, now: Date) { await this.prisma.notificationDelivery.update({ where: { id }, data: { status: 'delivered', providerId, deliveredAt: now, attempts: { increment: 1 }, lastError: null } }); }
  async scheduleRetry(id: string, attempts: number, nextAttemptAt: Date, error: string) { await this.prisma.notificationDelivery.update({ where: { id }, data: { status: 'pending', attempts, nextAttemptAt, lastError: error } }); }
  async markFailed(id: string, attempts: number, error: string) { await this.prisma.notificationDelivery.update({ where: { id }, data: { status: 'failed', attempts, lastError: error } }); }
  async disableDevice(deviceId: string) { await this.prisma.device.update({ where: { id: deviceId }, data: { enabled: false } }); }
}
