const sensitiveKey = /(password|secret|token|authorization|cookie|phone|address|recipient|question|answer|content|payload)/i;

export function redactSecurityMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecurityMetadata);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitiveKey.test(key) ? '[REDACTED]' : redactSecurityMetadata(item)]));
}

