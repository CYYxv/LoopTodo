import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/access-token.guard';
import { ScoringService } from './scoring.service';

@Controller('score')
@UseGuards(AccessTokenGuard)
export class ScoringController {
  constructor(private readonly service: ScoringService) {}

  @Get('today')
  today(@Req() request: AuthenticatedRequest) {
    return this.service.getToday(request.auth.sub);
  }

  @Get('history')
  history(
    @Req() request: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(30), ParseIntPipe) pageSize: number,
  ) {
    return this.service.getHistory(request.auth.sub, Math.max(1, page), Math.min(100, Math.max(1, pageSize)));
  }

  @Get('events')
  events(
    @Req() request: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.listRecentEvents(request.auth.sub, Math.min(50, Math.max(1, limit)));
  }
}
