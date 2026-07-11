import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { TASK_FOCUS_REPOSITORY } from './task-focus.repository';
import { PrismaTaskFocusRepository } from './prisma-task-focus.repository';
import { TaskFocusController } from './task-focus.controller';
import { TaskFocusService } from './task-focus.service';

@Module({
  imports: [AuthModule],
  controllers: [TaskFocusController],
  providers: [
    TaskFocusService,
    { provide: TASK_FOCUS_REPOSITORY, useClass: PrismaTaskFocusRepository },
  ],
})
export class TaskFocusModule {}
