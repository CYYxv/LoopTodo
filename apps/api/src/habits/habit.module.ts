import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { HabitController } from './habit.controller';
import { HABIT_REPOSITORY } from './habit.repository';
import { HabitService } from './habit.service';
import { PrismaHabitRepository } from './prisma-habit.repository';

@Module({
  imports: [AuthModule, SubscriptionModule],
  controllers: [HabitController],
  providers: [HabitService, { provide: HABIT_REPOSITORY, useClass: PrismaHabitRepository }],
})
export class HabitModule {}
