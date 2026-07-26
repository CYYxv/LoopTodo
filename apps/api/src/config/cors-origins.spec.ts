import { parseCorsOrigins } from './cors-origins';

test('parses configured reward admin origins', () => {
  expect(parseCorsOrigins(' http://127.0.0.1:4373, http://192.168.0.106:4373 ,,')).toEqual([
    'http://127.0.0.1:4373',
    'http://192.168.0.106:4373',
  ]);
});

test('returns false when no browser origin is configured', () => {
  expect(parseCorsOrigins('')).toBe(false);
});
