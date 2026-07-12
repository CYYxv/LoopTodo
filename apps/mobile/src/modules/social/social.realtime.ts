import { io, type Socket } from 'socket.io-client';
import type { PkMatch, RoomReaction } from './social.types';

export type SocialRealtime = { socket: Socket; joinRoom(roomId: string): void; subscribePk(matchId: string): void; close(): void };
export function connectSocialRealtime(baseUrl: string, accessToken: string, handlers: { reaction(value: RoomReaction): void; pk(value: PkMatch): void }): SocialRealtime {
  const socket = io(`${baseUrl.replace(/\/$/, '')}/social`, { auth: { token: accessToken }, transports: ['websocket'] });
  socket.on('room:reaction', handlers.reaction); socket.on('pk:progress', handlers.pk);
  return { socket, joinRoom(roomId) { socket.emit('room:join', { roomId }); }, subscribePk(matchId) { socket.emit('pk:subscribe', { matchId }); }, close() { socket.disconnect(); } };
}
