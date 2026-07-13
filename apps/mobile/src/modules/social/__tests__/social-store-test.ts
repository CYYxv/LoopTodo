jest.mock('../social.realtime', () => ({ connectSocialRealtime: jest.fn(() => ({ socket: { connected: false, emit: jest.fn() }, joinRoom: jest.fn(), subscribePk: jest.fn(), close: jest.fn() })) }));

import { connectSocialRealtime } from '../social.realtime';
import { createSocialStore } from '../social.store';

const mockConnect = jest.mocked(connectSocialRealtime);
const originalFetch = globalThis.fetch;

beforeEach(() => jest.clearAllMocks());
afterEach(() => { globalThis.fetch = originalFetch; });

test('does not connect until social is enabled and disconnects when disabled', () => {
  const store = createSocialStore();
  store.getState().configure('https://api.example.com', 'token');
  expect(mockConnect).not.toHaveBeenCalled();

  store.getState().setEnabled(true);
  expect(mockConnect).toHaveBeenCalledTimes(1);
  const connection = mockConnect.mock.results[0]!.value;

  store.getState().setEnabled(false);
  expect(connection.close).toHaveBeenCalledTimes(1);
  expect(store.getState().enabled).toBe(false);
});

test('reconnects an enabled realtime session after token refresh', () => {
  const store = createSocialStore();
  store.getState().configure('https://api.example.com', 'first-token');
  store.getState().setEnabled(true);

  store.getState().configure('https://api.example.com', 'second-token');

  expect(mockConnect).toHaveBeenLastCalledWith('https://api.example.com', 'second-token', expect.any(Object));
  expect(store.getState().enabled).toBe(true);
});

test('does not request data while social is disabled', async () => {
  const store = createSocialStore();
  store.getState().configure('https://api.example.com', 'token');
  globalThis.fetch = jest.fn();

  await store.getState().load();

  expect(globalThis.fetch).not.toHaveBeenCalled();
});
