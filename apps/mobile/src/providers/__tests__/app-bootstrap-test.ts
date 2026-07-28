import { hydrateApplicationData } from '../AppBootstrap';

test('hydrates auth before deciding whether task sessions may be restored', async () => {
  const calls: string[] = [];
  let status: 'hydrating' | 'signed_out' | 'signed_in' = 'hydrating';

  await hydrateApplicationData({
    hydrateAuth: async () => { calls.push('auth'); status = 'signed_out'; },
    getAuthStatus: () => status,
    hydrateTasks: async (restoreActiveSession) => { calls.push(`tasks:${restoreActiveSession}`); },
    hydrateHabits: async () => { calls.push('habits'); },
    hydrateSync: async () => { calls.push('sync'); },
  });

  expect(calls[0]).toBe('auth');
  expect(calls).toEqual(expect.arrayContaining(['tasks:false', 'habits', 'sync']));
});
