import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { OnGatewayConnection } from '@nestjs/websockets';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

import { TokenService } from '../auth/token.service';
import { SocialService } from './social.service';
import { isReactionEmoji } from './social.policy';
import { EventBusService } from '../common/event-bus.module';

@WebSocketGateway({ namespace: '/social', cors: { origin: false } })
export class SocialGateway implements OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  constructor(private readonly tokens: TokenService, private readonly social: SocialService, private readonly events: EventBusService) {}
  private readonly logger = new Logger(SocialGateway.name);
  private readonly scoreListener = (userId: string) => { void this.broadcastPk(userId).catch((error) => this.logger.error('Failed to broadcast PK progress', error)); };
  onModuleInit() { this.events.on('score.settled', this.scoreListener); }
  onModuleDestroy() { this.events.off('score.settled', this.scoreListener); }

  async handleConnection(socket: Socket) {
    const token = typeof socket.handshake.auth.token === 'string' ? socket.handshake.auth.token : null;
    if (!token) return socket.disconnect(true);
    try { socket.data.userId = (await this.tokens.verifyAccess(token)).sub; await this.social.ensureSocialEnabled(socket.data.userId); }
    catch { socket.disconnect(true); }
  }

  @SubscribeMessage('room:join')
  async joinRoom(@ConnectedSocket() socket: Socket, @MessageBody() body: { roomId: string }) {
    await this.social.ensureRoomMember(socket.data.userId, body.roomId); await socket.join(`room:${body.roomId}`);
    return { event: 'room:joined', data: { roomId: body.roomId } };
  }

  @SubscribeMessage('room:reaction')
  async reaction(@ConnectedSocket() socket: Socket, @MessageBody() body: { roomId: string; emoji: string }) {
    if (!isReactionEmoji(body.emoji)) return { event: 'error', data: { code: 'INVALID_REACTION' } };
    const reaction = await this.social.sendReaction(socket.data.userId, body.roomId, body.emoji);
    this.server.to(`room:${body.roomId}`).emit('room:reaction', { roomId: body.roomId, emoji: reaction.emoji, nickname: reaction.user.nickname, createdAt: reaction.createdAt });
  }

  @SubscribeMessage('pk:subscribe')
  async subscribePk(@ConnectedSocket() socket: Socket, @MessageBody() body: { matchId: string }) {
    const match = await this.social.getPkMatch(socket.data.userId, body.matchId); await socket.join(`pk:${body.matchId}`);
    this.server.to(`pk:${body.matchId}`).emit('pk:progress', match);
  }

  private async broadcastPk(userId: string) { const matches = await this.social.listTodayPk(userId); matches.forEach((match) => this.server.to(`pk:${match.id}`).emit('pk:progress', match)); }
}
