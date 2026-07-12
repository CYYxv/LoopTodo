import { isNavigationAllowed, normalizeWebResource } from '../resource-pass.policy';
import type { ResourcePass } from '../resource-pass.types';

const resource = (type: 'url' | 'domain', value: string): ResourcePass => ({ id: 'pass', taskId: 'task', type, value, displayName: value, valueHash: 'hash', createdAt: 0 });

describe('resource pass navigation policy', () => {
  test('exact URL blocks unrelated paths, downloads and deep links', () => {
    const pass = resource('url', normalizeWebResource('url', 'https://docs.example.com/chapter/1'));
    expect(isNavigationAllowed(pass, 'https://docs.example.com/chapter/1')).toBe(true);
    expect(isNavigationAllowed(pass, 'https://docs.example.com/chapter/2')).toBe(false);
    expect(isNavigationAllowed(pass, 'intent://open')).toBe(false);
    expect(() => normalizeWebResource('url', 'http://example.com')).toThrow('仅允许 HTTPS');
  });

  test('domain mode permits only the domain and its subdomains', () => {
    const pass = resource('domain', normalizeWebResource('domain', 'example.com'));
    expect(isNavigationAllowed(pass, 'https://learn.example.com/course')).toBe(true);
    expect(isNavigationAllowed(pass, 'https://example.com/')).toBe(true);
    expect(isNavigationAllowed(pass, 'https://example.com.evil.test/')).toBe(false);
    expect(isNavigationAllowed(pass, 'https://example.com/feed/latest')).toBe(false);
  });
});
