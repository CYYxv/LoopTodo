import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ScoringModule } from '../scoring/scoring.module';
import { FamilyModule } from '../family/family.module';

import { TASK_FOCUS_REPOSITORY } from './task-focus.repository';
import { PrismaTaskFocusRepository } from './prisma-task-focus.repository';
import { TaskFocusController } from './task-focus.controller';
import { TaskFocusService } from './task-focus.service';

@Module({
  imports: [AuthModule, ScoringModule, FamilyModule],
  controllers: [TaskFocusController],
  providers: [
    TaskFocusService,
    { provide: TASK_FOCUS_REPOSITORY, useClass: PrismaTaskFocusRepository },
  ],
})
export class TaskFocusModule {}
