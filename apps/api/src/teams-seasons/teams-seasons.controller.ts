import { BadRequestException, Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/access-token.guard';
import { CreateTeamDto } from './dto/create-team.dto';
import { JoinTeamDto } from './dto/join-team.dto';
import { TeamsSeasonsService } from './teams-seasons.service';

@Controller()
@UseGuards(AccessTokenGuard)
export class TeamsSeasonsController {
  constructor(private readonly service: TeamsSeasonsService) {}
  @Get('seasons/current') season() { return this.service.currentSeason(); }
  @Get('seasons/current/rank') rank(@Req() request: AuthenticatedRequest) { return this.service.currentRank(request.auth.sub); }
  @Get('leaderboards') leaderboard(@Req() request: AuthenticatedRequest, @Query('period') period: 'today' | 'week' | 'month' | 'season' = 'today', @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number) { if (!['today', 'week', 'month', 'season'].includes(period)) throw new BadRequestException({ code: 'INVALID_LEADERBOARD_PERIOD', message: '排行榜周期无效' }); return this.service.leaderboard(period, Math.min(200, Math.max(1, limit)), request.auth.sub); }
  @Post('teams') create(@Req() request: AuthenticatedRequest, @Body() input: CreateTeamDto) { return this.service.createTeam(request.auth.sub, input.name); }
  @Post('teams/join') join(@Req() request: AuthenticatedRequest, @Body() input: JoinTeamDto) { return this.service.joinTeam(request.auth.sub, input.joinCode); }
  @Get('teams/mine') mine(@Req() request: AuthenticatedRequest) { return this.service.myTeam(request.auth.sub); }
  @Get('teams/leaderboard') teamLeaderboard(@Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number) { return this.service.teamLeaderboard(Math.min(200, Math.max(1, limit))); }
}
