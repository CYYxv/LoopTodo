import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/access-token.guard';
import { CreatePkMatchDto } from './dto/create-pk-match.dto';
import { CreateStudyRoomDto } from './dto/create-study-room.dto';
import { InviteFriendDto } from './dto/invite-friend.dto';
import { JoinStudyRoomDto } from './dto/join-study-room.dto';
import { ReportUserDto } from './dto/report-user.dto';
import { SendReactionDto } from './dto/send-reaction.dto';
import { SocialService } from './social.service';

@Controller()
@UseGuards(AccessTokenGuard)
export class SocialController {
  constructor(private readonly service: SocialService) {}
  @Get('friends') friends(@Req() request: AuthenticatedRequest) { return this.service.listFriends(request.auth.sub); }
  @Post('friends/invite') invite(@Req() request: AuthenticatedRequest, @Body() input: InviteFriendDto) { return this.service.inviteFriend(request.auth.sub, input.email); }
  @Post('friends/:id/accept') accept(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.service.acceptFriend(request.auth.sub, id); }
  @Post('friends/:id/remove') remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.service.removeFriend(request.auth.sub, id); }
  @Post('friends/:id/block') block(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.service.blockFriend(request.auth.sub, id); }
  @Post('social/reports') report(@Req() request: AuthenticatedRequest, @Body() input: ReportUserDto) { return this.service.reportUser(request.auth.sub, input.targetUserId, input.reason); }
  @Get('pk-matches/today') pkToday(@Req() request: AuthenticatedRequest) { return this.service.listTodayPk(request.auth.sub); }
  @Get('pk-matches/history') pkHistory(@Req() request: AuthenticatedRequest, @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number) { return this.service.listPkHistory(request.auth.sub, limit); }
  @Post('pk-matches') createPk(@Req() request: AuthenticatedRequest, @Body() input: CreatePkMatchDto) { return this.service.createPkMatch(request.auth.sub, input.friendUserId); }
  @Get('study-rooms') rooms(@Req() request: AuthenticatedRequest) { return this.service.listRooms(request.auth.sub); }
  @Post('study-rooms') createRoom(@Req() request: AuthenticatedRequest, @Body() input: CreateStudyRoomDto) { return this.service.createRoom(request.auth.sub, input.name, input.visibility); }
  @Post('study-rooms/join') joinRoom(@Req() request: AuthenticatedRequest, @Body() input: JoinStudyRoomDto) { return this.service.joinRoom(request.auth.sub, input.roomId, input.inviteCode); }
  @Post('study-rooms/:id/reactions') react(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: SendReactionDto) { return this.service.sendReaction(request.auth.sub, id, input.emoji); }
  @Get('social/users/:id/status') status(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.service.sharedStatus(request.auth.sub, id); }
}
