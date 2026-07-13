export function apiErrorMessage(body: unknown, fallback: string) {
  const error = body && typeof body === 'object' && 'error' in body
    ? (body as { error?: { code?: unknown; message?: unknown } }).error
    : null;
  if (error?.code === 'INTERNAL_ERROR' || error?.message === '服务器内部错误') {
    return '服务暂时不可用，请稍后重试';
  }
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  if (typeof error?.code === 'string' && error.code.trim()) return error.code;
  return fallback;
}
