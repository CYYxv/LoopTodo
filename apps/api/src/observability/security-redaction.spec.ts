import { redactSecurityMetadata } from './security-redaction';

describe('redactSecurityMetadata', () => {
  test('removes sensitive values recursively while retaining safe audit facts', () => {
    const result = redactSecurityMetadata({
      action: 'address_read', token: 'bearer-value', nested: { phone: '13800138000', question: 'raw prompt', reason: 'invalid_signature' },
    });
    expect(result).toEqual({ action: 'address_read', token: '[REDACTED]', nested: { phone: '[REDACTED]', question: '[REDACTED]', reason: 'invalid_signature' } });
  });
});

