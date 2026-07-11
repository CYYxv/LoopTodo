import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/access-token.guard';
import { AddHabitProgressDto } from './dto/add-habit-progress.dto';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { HabitService } from './habit.service';

@Controller('habits')
@UseGuards(AccessTokenGuard)
export class HabitController {
  constructor(private readonly service: HabitService) {}

  @Get() list(@Req() request: AuthenticatedRequest, @Query('date') date?: string) { return this.service.list(request.auth.sub, date); }
  @Post() create(@Req() request: AuthenticatedRequest, @Body() input: CreateHabitDto) { return this.service.create(request.auth.sub, input); }
  @Patch(':id') update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: UpdateHabitDto) { return this.service.update(request.auth.sub, id, input); }
  @Delete(':id') archive(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Query('version', ParseIntPipe) version: number) { return this.service.archive(request.auth.sub, id, version); }
  @Post(':id/progress') addProgress(@Req() request: AuthenticatedRequest, @Param('id') id: string,
    @Headers('idempotency-key') key: string, @Body() input: AddHabitProgressDto) {
    return this.service.addProgress(request.auth.sub, id, key, input);
  }
  @Get(':id/progress') listProgress(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.listProgress(request.auth.sub, id);
  }
}
