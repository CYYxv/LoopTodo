import type { ResourcePass } from './resource-pass.types';

export function normalizeWebResource(type: 'url' | 'domain', raw: string) {
  const value = raw.trim();
  const candidate = type === 'domain' && !value.includes('://') ? `https://${value}` : value;
  const url = new URL(candidate);
  if (url.protocol !== 'https:') throw new Error('仅允许 HTTPS 资源');
  if (url.username || url.password || !url.hostname) throw new Error('资源地址无效');
  return type === 'domain' ? url.hostname.toLowerCase() : url.toString();
}

export function isNavigationAllowed(resource: ResourcePass, target: string) {
  let url: URL;
  try { url = new URL(target); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  if (/(^|\/)\b(feed|recommend|recommended|shorts|explore|trending)\b(\/|$)/i.test(url.pathname)) return false;
  if (resource.type === 'url') return stripFragment(url.toString()) === stripFragment(resource.value);
  if (resource.type === 'domain') return url.hostname.toLowerCase() === resource.value || url.hostname.toLowerCase().endsWith(`.${resource.value}`);
  return false;
}

function stripFragment(value: string) { const url = new URL(value); url.hash = ''; return url.toString(); }
