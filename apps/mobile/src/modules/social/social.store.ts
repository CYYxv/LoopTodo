import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { offlineFeatureMessage } from '../../shared/offline-feature-message';
import { createHttpSocialClient, type SocialClient } from './social.client';
import { connectSocialRealtime, type SocialRealtime } from './social.realtime';
import { track } from '@/modules/analytics/analytics';
import type { Friend, PkMatch, RoomReaction, StudyRoom } from './social.types';

type SocialStore = {
  configured: boolean;
  enabled: boolean;
  baseUrl: string;
  token: string;
  client: SocialClient | null;
  realtime: SocialRealtime | null;
  friends: Friend[];
  matches: PkMatch[];
  rooms: StudyRoom[];
  reactions: RoomReaction[];
  loading: boolean;
  error: string | null;
  configure(baseUrl: string, token: string): void;
  setEnabled(enabled: boolean): void;
  load(): Promise<void>;
  invite(email: string): Promise<void>;
  accept(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  block(id: string): Promise<void>;
  report(targetUserId: string, reason: string): Promise<void>;
  createPk(userId: string): Promise<void>;
  createRoom(name: string, visibility: 'public' | 'private'): Promise<void>;
  joinRoom(room: StudyRoom): Promise<void>;
  joinByCode(inviteCode: string): Promise<void>;
  react(roomId: string, emoji: string): Promise<void>;
  subscribePk(id: string): void;
};

export function createSocialStore() {
  return createStore<SocialStore>((set, get) => ({
    configured: false,
    enabled: false,
    baseUrl: '',
    token: '',
    client: null,
    realtime: null,
    friends: [],
    matches: [],
    rooms: [],
    reactions: [],
    loading: false,
    error: null,
    configure(baseUrl, token) {
      const wasEnabled = get().enabled;
      get().realtime?.close();
      set({ configured: true, enabled: false, baseUrl, token, client: createHttpSocialClient(baseUrl, token), realtime: null, error: null });
      if (wasEnabled) get().setEnabled(true);
    },
    setEnabled(enabled) {
      if (!enabled) {
        get().realtime?.close();
        return set({ enabled: false, realtime: null, loading: false, error: null });
      }
      if (!get().configured || get().enabled) return;
      const realtime = connectSocialRealtime(get().baseUrl, get().token, {
        reaction: (value) => set((state) => ({ reactions: [...state.reactions.slice(-29), value] })),
        pk: (value) => set((state) => ({ matches: state.matches.map((item) => item.id === value.id ? value : item) })),
      });
      set({ enabled: true, realtime, error: null });
    },
    async load() {
      const { client, enabled } = get();
      if (!client || !enabled || get().loading) return;
      set({ loading: true, error: null });
      try {
        const [friends, matches, rooms] = await Promise.all([client.friends(), client.matches(), client.rooms()]);
        if (!get().enabled) return set({ loading: false });
        set({ friends, matches, rooms, loading: false });
        matches.forEach((match) => get().realtime?.subscribePk(match.id));
      } catch (error) {
        set({ loading: false, error: get().enabled ? message(error) : null });
      }
    },
    async invite(email) { await action(get, set, (client) => client.invite(email)); },
    async accept(id) { await action(get, set, (client) => client.accept(id)); },
    async remove(id) { await action(get, set, (client) => client.remove(id)); },
    async block(id) { await action(get, set, (client) => client.block(id)); },
    async report(targetUserId, reason) { if (await action(get, set, (client) => client.report(targetUserId, reason))) track('social_report', { targetUserId }); },
    async createPk(userId) { if (await action(get, set, (client) => client.createPk(userId))) track('social_pk_create', { friendUserId: userId }); },
    async createRoom(name, visibility) {
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 15) return set({ error: '房间名称需要 1–15 个字' });
      await action(get, set, (client) => client.createRoom(trimmed, visibility));
    },
    async joinRoom(room) {
      if (await action(get, set, async (client) => { await client.joinRoom({ roomId: room.id }); })) get().realtime?.joinRoom(room.id);
    },
    async joinByCode(inviteCode) {
      const client = get().client;
      if (!client || !get().enabled) return set({ error: '社交服务尚未连接' });
      try {
        const member = await client.joinRoom({ inviteCode });
        await get().load();
        get().realtime?.joinRoom(member.roomId);
      } catch (error) { set({ error: message(error) }); }
    },
    async react(roomId, emoji) {
      if (!get().enabled) return set({ error: '社交服务尚未连接' });
      const realtime = get().realtime;
      if (realtime?.socket.connected) realtime.socket.emit('room:reaction', { roomId, emoji });
      else await action(get, set, (client) => client.react(roomId, emoji), false);
    },
    subscribePk(id) { if (get().enabled) get().realtime?.subscribePk(id); },
  }));
}

async function action(get: () => SocialStore, set: (value: Partial<SocialStore>) => void, run: (client: SocialClient) => Promise<void>, reload = true) {
  const client = get().client;
  if (!client || !get().enabled) { set({ error: '社交服务尚未连接' }); return false; }
  try {
    await run(client);
    if (reload) await get().load();
    return true;
  } catch (error) { set({ error: message(error) }); return false; }
}

export const socialStore = createSocialStore();
export function configureSocial(baseUrl: string, token: string) { socialStore.getState().configure(baseUrl, token); }
export function useSocialStore<T>(selector: (state: SocialStore) => T) { return useStore(socialStore, selector); }
function message(error: unknown) { return offlineFeatureMessage(error, '社交操作失败'); }