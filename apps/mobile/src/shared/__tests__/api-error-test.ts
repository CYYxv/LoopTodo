import { apiErrorMessage } from '../api-error';

test('replaces raw server errors with a retryable message', () => {
  expect(apiErrorMessage({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' } }, '请求失败')).toBe('服务暂时不可用，请稍后重试');
  expect(apiErrorMessage({ error: { code: 'FAMILY_VIP_REQUIRED', message: '需要 VIP' } }, '请求失败')).toBe('需要 VIP');
});
