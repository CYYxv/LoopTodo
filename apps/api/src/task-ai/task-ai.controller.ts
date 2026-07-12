import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/access-token.guard';
import { AskTaskAiDto } from './dto/ask-task-ai.dto';
import { CreateAiMaterialDto } from './dto/create-ai-material.dto';
import { TaskAiService } from './task-ai.service';

@Controller('tasks/:taskId/ai')
@UseGuards(AccessTokenGuard)
export class TaskAiController {
  constructor(private readonly service: TaskAiService) {}
  @Get('materials') list(@Req() request: AuthenticatedRequest, @Param('taskId') taskId: string) { return this.service.listMaterials(request.auth.sub, taskId); }
  @Post('materials') create(@Req() request: AuthenticatedRequest, @Param('taskId') taskId: string, @Body() input: CreateAiMaterialDto) { return this.service.createMaterial(request.auth.sub, taskId, input); }
  @Post('query') ask(@Req() request: AuthenticatedRequest, @Param('taskId') taskId: string, @Body() input: AskTaskAiDto) { return this.service.ask(request.auth.sub, taskId, input.question, input.materialIds); }
}
