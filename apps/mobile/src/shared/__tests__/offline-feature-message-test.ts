import { offlineFeatureMessage } from '../offline-feature-message';

test('uses a clear offline message for network failures', () => {
  expect(offlineFeatureMessage(new TypeError('Network request failed'), '社交加载失败')).toBe('连接网络后可用');
  expect(offlineFeatureMessage(new Error('业务错误'), '社交加载失败')).toBe('业务错误');
});
