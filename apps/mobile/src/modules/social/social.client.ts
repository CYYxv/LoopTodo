import type { Friend, PkMatch, StudyRoom } from './social.types';
import { apiErrorMessage } from '@/shared/api-error';

export interface SocialClient {
  friends(): Promise<Friend[]>;
  invite(email: string): Promise<void>;
  accept(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  block(id: string): Promise<void>;
  report(targetUserId: string, reason: string): Promise<void>;
  matches(): Promise<PkMatch[]>;
  historyMatches(limit?: number): Promise<PkMatch[]>;
  createPk(friendUserId: string): Promise<void>;
  rooms(): Promise<StudyRoom[]>;
  createRoom(name: string, visibility: 'public' | 'private'): Promise<void>;
  joinRoom(input: { roomId?: string; inviteCode?: string }): Promise<{ roomId: string }>;
  react(roomId: string, emoji: string): Promise<void>;
}

export function createHttpSocialClient(baseUrl: string, accessToken: string): SocialClient {
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
        ...init?.headers,
      },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(apiErrorMessage(body, '社交请求失败'));
    return body.data as T;
  };

  return {
    friends: () => request('/friends'),
    invite: (email) => request('/friends/invite', { method: 'POST', body: JSON.stringify({ email }) }),
    accept: (id) => request(`/friends/${id}/accept`, { method: 'POST' }),
    remove: (id) => request(`/friends/${id}/remove`, { method: 'POST' }),
    block: (id) => request(`/friends/${id}/block`, { method: 'POST' }),
    report: (targetUserId, reason) =>
      request('/social/reports', { method: 'POST', body: JSON.stringify({ targetUserId, reason }) }),
    matches: () => request('/pk-matches/today'),
    historyMatches: (limit = 30) => request(`/pk-matches/history?limit=${limit}`),
    createPk: (friendUserId) => request('/pk-matches', { method: 'POST', body: JSON.stringify({ friendUserId }) }),
    rooms: () => request('/study-rooms'),
    createRoom: (name, visibility) =>
      request('/study-rooms', { method: 'POST', body: JSON.stringify({ name, visibility }) }),
    joinRoom: (input) => request('/study-rooms/join', { method: 'POST', body: JSON.stringify(input) }),
    react: (roomId, emoji) =>
      request(`/study-rooms/${roomId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  };
}
