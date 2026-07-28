import type { LockEngine } from '../lock-engine.port';
import { createLockEngineStore } from '../lock-engine.store';

test('confirmRisk calls the public LockEngine method', async () => {
  const confirmRisk = jest.fn(async () => undefined);
  const engine = {
    confirmRisk,
    async checkCapabilities() { throw new Error('not used'); },
  } as unknown as LockEngine;
  const store = createLockEngineStore(engine);

  await store.getState().confirmRisk();

  expect(confirmRisk).toHaveBeenCalledTimes(1);
});
