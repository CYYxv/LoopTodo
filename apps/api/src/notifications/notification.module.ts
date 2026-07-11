import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FcmPushProvider, TestPushProvider, VendorPushProvider } from './http-push.providers';
import { NotificationController } from './notification.controller';
import { NOTIFICATION_REPOSITORY } from './notification.repository';
import { NotificationService, NotificationWorker } from './notification.service';
import { PrismaNotificationRepository } from './prisma-notification.repository';
import { PUSH_PROVIDERS } from './push-provider';

@Module({
  imports: [AuthModule], controllers: [NotificationController],
  providers: [NotificationService, NotificationWorker, FcmPushProvider, VendorPushProvider, TestPushProvider,
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
    { provide: PUSH_PROVIDERS, inject: [FcmPushProvider, VendorPushProvider, TestPushProvider],
      useFactory: (fcm: FcmPushProvider, vendor: VendorPushProvider, test: TestPushProvider) => [fcm, vendor, test] }],
  exports: [NotificationService, NotificationWorker],
})
export class NotificationModule {}
