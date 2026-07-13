import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/environment';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { HabitModule } from './habits/habit.module';
import { TaskFocusModule } from './task-focus/task-focus.module';
import { NotificationModule } from './notifications/notification.module';
import { TaskAiModule } from './task-ai/task-ai.module';
import { ScoringModule } from './scoring/scoring.module';
import { SocialModule } from './social/social.module';
import { EventBusModule } from './common/event-bus.module';
import { TeamsSeasonsModule } from './teams-seasons/teams-seasons.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { FamilyModule } from './family/family.module';
import { RewardModule } from './rewards/reward.module';
import { ObservabilityModule } from './observability/observability.module';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    EventBusModule,
    ObservabilityModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    TaskFocusModule,
    HabitModule,
    NotificationModule,
    TaskAiModule,
    ScoringModule,
    SocialModule,
    TeamsSeasonsModule,
    SubscriptionModule,
    FamilyModule,
    RewardModule,
  ],
})
export class AppModule {}
