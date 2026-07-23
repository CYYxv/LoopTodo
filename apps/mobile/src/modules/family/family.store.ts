import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { offlineFeatureMessage } from '../../shared/offline-feature-message';
import { createFamilyClient, type FamilyClient, type FamilyTaskInput } from './family.client';
import { track } from '@/modules/analytics/analytics';
import type { FamilyAnomalyType } from './family-anomaly';
import type { FamilyAssignment, FamilyChangeRequest, FamilyChildStatus, FamilyGroupMembership } from './family.types';

type FamilyStore = {
  configured: boolean;
  client: FamilyClient | null;
  groups: FamilyGroupMembership[];
  assignments: FamilyAssignment[];
  requests: Record<string, FamilyChangeRequest[]>;
  inviteCode: string | null;
  childStatus: FamilyChildStatus | null;
  loading: boolean;
  error: string | null;
  configure(baseUrl: string, token: string): void;
  load(): Promise<void>;
  createGroup(name: string): Promise<void>;
  invite(groupId: string, role: string): Promise<void>;
  join(code: string): Promise<void>;
  assign(groupId: string, input: FamilyTaskInput): Promise<void>;
  leave(groupId: string): Promise<void>;
  requestChange(id: string, type: 'update' | 'delete', reason: string, title?: string): Promise<void>;
  loadRequests(groupId: string): Promise<void>;
  review(groupId: string, id: string, decision: 'approved' | 'rejected'): Promise<void>;
  loadStatus(childId: string): Promise<void>;
  /** 静默上报；非孩子账号时服务端 notified=0。失败不写全局 error。 */
  reportAnomaly(type: FamilyAnomalyType, taskId?: string): Promise<void>;
};

export function createFamilyStore() {
  return createStore<FamilyStore>((set, get) => ({
    configured: false,
    client: null,
    groups: [],
    assignments: [],
    requests: {},
    inviteCode: null,
    childStatus: null,
    loading: false,
    error: null,
    configure(baseUrl, token) {
      set({ configured: true, client: createFamilyClient(baseUrl, token), error: null });
    },
    async load() {
      const client = get().client;
      if (!client || get().loading) return;
      set({ loading: true, error: null });
      try {
        const [groups, assignments] = await Promise.all([client.groups(), client.assignments()]);
        set({ groups, assignments, loading: false, error: null });
      } catch (error) {
        set({ loading: false, error: message(error) });
      }
    },
    async createGroup(name) {
      await mutate(get, set, (client) => client.createGroup(name));
    },
    async invite(groupId, role) {
      const client = get().client;
      if (!client) return set({ error: '登录后才能创建家庭邀请' });
      try {
        set({ inviteCode: (await client.invite(groupId, role)).code, error: null });
      } catch (error) {
        set({ error: message(error) });
      }
    },
    async join(code) {
      await mutate(get, set, (client) => client.join(code));
    },
    async assign(groupId, input) {
      await mutate(get, set, (client) => client.assign(groupId, input));
      track('family_task_assign');
    },
    async leave(groupId) {
      await mutate(get, set, (client) => client.leave(groupId));
    },
    async requestChange(id, type, reason, title) {
      await mutate(get, set, (client) => client.requestChange(id, type, reason, title));
    },
    async loadRequests(groupId) {
      const client = get().client;
      if (!client) return;
      try {
        const items = await client.requests(groupId);
        set((state) => ({ requests: { ...state.requests, [groupId]: items }, error: null }));
      } catch (error) {
        set({ error: message(error) });
      }
    },
    async review(groupId, id, decision) {
      const client = get().client;
      if (!client) return;
      try {
        await client.review(id, decision);
        await get().loadRequests(groupId);
      } catch (error) {
        set({ error: message(error) });
      }
    },
    async loadStatus(childId) {
      const client = get().client;
      if (!client) return;
      try {
        set({ childStatus: await client.status(childId), error: null });
      } catch (error) {
        set({ error: message(error) });
      }
    },
    async reportAnomaly(type, taskId) {
      const client = get().client;
      if (!client) return;
      try {
        await client.reportAnomaly(type, taskId);
        track('family_anomaly', { type, taskId: taskId ?? null });
      } catch {
        // 离线或非孩子身份时静默；服务端按日 dedupe
      }
    },
  }));
}

async function mutate(
  get: () => FamilyStore,
  set: (value: Partial<FamilyStore>) => void,
  action: (client: FamilyClient) => Promise<void>,
) {
  const client = get().client;
  if (!client) return set({ error: '登录后才能使用家庭功能' });
  try {
    await action(client);
    await get().load();
  } catch (error) {
    set({ error: message(error) });
  }
}

export const familyStore = createFamilyStore();
export function configureFamily(baseUrl: string, token: string) {
  familyStore.getState().configure(baseUrl, token);
}
export function useFamilyStore<T>(selector: (state: FamilyStore) => T) {
  return useStore(familyStore, selector);
}
function message(error: unknown) {
  return offlineFeatureMessage(error, '家庭操作失败');
}
