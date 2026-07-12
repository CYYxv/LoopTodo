import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = { requestId: string };

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(requestId: string, callback: () => T) {
  return storage.run({ requestId }, callback);
}

export function currentRequestId() {
  return storage.getStore()?.requestId ?? null;
}

