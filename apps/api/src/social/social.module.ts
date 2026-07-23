import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notifications/notification.module';
import { SocialController } from './social.controller';
import { SocialGateway } from './social.gateway';
import { SocialService } from './social.service';

@Module({ imports: [AuthModule, NotificationModule], controllers: [SocialController], providers: [SocialService, SocialGateway] })
export class SocialModule {}
