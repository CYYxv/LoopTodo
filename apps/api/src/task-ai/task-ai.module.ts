import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ObservabilityModule } from '../observability/observability.module';
import { AI_PROVIDERS } from './ai-provider';
import { HttpAiProvider, TestAiProvider } from './ai.providers';
import { PrismaTaskAiRepository } from './prisma-task-ai.repository';
import { TaskAiController } from './task-ai.controller';
import { TASK_AI_REPOSITORY } from './task-ai.repository';
import { TaskAiService } from './task-ai.service';

@Module({ imports: [AuthModule, SubscriptionModule, ObservabilityModule], controllers: [TaskAiController], providers: [TaskAiService, HttpAiProvider, TestAiProvider,
  { provide: TASK_AI_REPOSITORY, useClass: PrismaTaskAiRepository },
  { provide: AI_PROVIDERS, inject: [HttpAiProvider, TestAiProvider], useFactory: (http: HttpAiProvider, test: TestAiProvider) => [http, test] }] })
export class TaskAiModule {}
