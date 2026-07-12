import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { createHttpSocialClient, type SocialClient } from './social.client';
import { connectSocialRealtime, type SocialRealtime } from './social.realtime';
import type { Friend, PkMatch, RoomReaction, StudyRoom } from './social.types';

type SocialStore = { configured: boolean; client: SocialClient | null; realtime: SocialRealtime | null; friends: Friend[]; matches: PkMatch[]; rooms: StudyRoom[]; reactions: RoomReaction[]; loading: boolean; error: string | null;
  configure(baseUrl: string, token: string): void; load(): Promise<void>; invite(email: string): Promise<void>; accept(id: string): Promise<void>; createPk(userId: string): Promise<void>;
  createRoom(name: string, visibility: 'public' | 'private'): Promise<void>; joinRoom(room: StudyRoom): Promise<void>; joinByCode(inviteCode: string): Promise<void>; react(roomId: string, emoji: string): Promise<void>; subscribePk(id: string): void };
export function createSocialStore() {
  return createStore<SocialStore>((set, get) => ({ configured: false, client: null, realtime: null, friends: [], matches: [], rooms: [], reactions: [], loading: false, error: null,
    configure(baseUrl, token) { get().realtime?.close(); const client = createHttpSocialClient(baseUrl, token);
      const realtime = connectSocialRealtime(baseUrl, token, { reaction: (value) => set((state) => ({ reactions: [...state.reactions.slice(-29), value] })),
        pk: (value) => set((state) => ({ matches: state.matches.map((item) => item.id === value.id ? value : item) })) }); set({ configured: true, client, realtime, error: null }); },
    async load() { const client = get().client; if (!client) return; set({ loading: true, error: null }); try { const [friends, matches, rooms] = await Promise.all([client.friends(), client.matches(), client.rooms()]);
      set({ friends, matches, rooms, loading: false }); matches.forEach((match) => get().realtime?.subscribePk(match.id)); } catch (error) { set({ loading: false, error: message(error) }); } },
    async invite(email) { await action(get, set, (client) => client.invite(email)); }, async accept(id) { await action(get, set, (client) => client.accept(id)); },
    async createPk(userId) { await action(get, set, (client) => client.createPk(userId)); }, async createRoom(name, visibility) { await action(get, set, (client) => client.createRoom(name, visibility)); },
    async joinRoom(room) { await action(get, set, async (client) => { await client.joinRoom({ roomId: room.id }); }); get().realtime?.joinRoom(room.id); },
    async joinByCode(inviteCode) { const client = get().client; if (!client) return set({ error: '登录后才能加入私密自习室' }); try { const member = await client.joinRoom({ inviteCode }); await get().load(); get().realtime?.joinRoom(member.roomId); } catch (error) { set({ error: message(error) }); } },
    async react(roomId, emoji) { const realtime = get().realtime; if (realtime?.socket.connected) realtime.socket.emit('room:reaction', { roomId, emoji }); else await action(get, set, (client) => client.react(roomId, emoji), false); },
    subscribePk(id) { get().realtime?.subscribePk(id); },
  }));
}
async function action(get: () => SocialStore, set: (value: Partial<SocialStore>) => void, run: (client: SocialClient) => Promise<void>, reload = true) { const client = get().client;
  if (!client) return set({ error: '登录后才能使用社交功能' }); try { await run(client); if (reload) await get().load(); } catch (error) { set({ error: message(error) }); } }
export const socialStore = createSocialStore();
export function configureSocial(baseUrl: string, token: string) { socialStore.getState().configure(baseUrl, token); }
export function useSocialStore<T>(selector: (state: SocialStore) => T) { return useStore(socialStore, selector); }
function message(error: unknown) { return error instanceof Error ? error.message : '社交操作失败'; }
