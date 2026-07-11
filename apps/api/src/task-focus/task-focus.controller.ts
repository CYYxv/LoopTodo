import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/access-token.guard';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { AddGoalProgressDto } from './dto/add-goal-progress.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { FinishSessionDto } from './dto/finish-session.dto';
import { StartSessionDto } from './dto/start-session.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFocusService } from './task-focus.service';

@Controller()
@UseGuards(AccessTokenGuard)
export class TaskFocusController {
  constructor(private readonly service: TaskFocusService) {}

  @Get('task-categories')
  listCategories(@Req() request: AuthenticatedRequest) { return this.service.listCategories(request.auth.sub); }

  @Post('task-categories')
  createCategory(@Req() request: AuthenticatedRequest, @Body() input: CreateCategoryDto) {
    return this.service.createCategory(request.auth.sub, input.name, input.color);
  }

  @Get('tasks')
  listTasks(@Req() request: AuthenticatedRequest) { return this.service.listTasks(request.auth.sub); }

  @Post('tasks')
  createTask(@Req() request: AuthenticatedRequest, @Body() input: CreateTaskDto) {
    return this.service.createTask(request.auth.sub, input);
  }

  @Get('tasks/:id')
  getTask(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.getTask(request.auth.sub, id);
  }

  @Patch('tasks/:id')
  updateTask(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: UpdateTaskDto) {
    return this.service.updateTask(request.auth.sub, id, input);
  }

  @Delete('tasks/:id')
  archiveTask(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Query('version', ParseIntPipe) version: number) {
    return this.service.archiveTask(request.auth.sub, id, version);
  }

  @Post('tasks/:id/complete')
  completeTask(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: CompleteTaskDto) {
    return this.service.completeTask(request.auth.sub, id, input.version);
  }

  @Post('tasks/:id/progress')
  addGoalProgress(@Req() request: AuthenticatedRequest, @Param('id') id: string,
    @Headers('idempotency-key') key: string, @Body() input: AddGoalProgressDto) {
    return this.service.addGoalProgress(request.auth.sub, id, input.version, input.amount, key);
  }

  @Post('tasks/:id/start-focus')
  startFocus(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Headers('idempotency-key') key: string, @Body() input: StartSessionDto) {
    return this.service.startSession(request.auth.sub, id, 'focus', key, input.trustLevel);
  }

  @Post('tasks/:id/start-lock')
  startLock(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Headers('idempotency-key') key: string, @Body() input: StartSessionDto) {
    return this.service.startSession(request.auth.sub, id, 'lock', key, input.trustLevel);
  }

  @Post('focus-sessions/:id/finish')
  finishSession(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Headers('idempotency-key') key: string, @Body() input: FinishSessionDto) {
    return this.service.finishSession(request.auth.sub, id, key, input);
  }

  @Get('focus-sessions')
  listSessions(@Req() request: AuthenticatedRequest) { return this.service.listSessions(request.auth.sub); }

  @Get('sync/task-focus')
  sync(@Req() request: AuthenticatedRequest, @Query('since') since?: string) {
    return this.service.sync(request.auth.sub, since);
  }
}
