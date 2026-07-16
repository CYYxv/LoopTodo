const NETWORK_ERROR_PATTERN = /network request failed|failed to fetch|fetch failed|network error/i;

export function offlineFeatureMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return NETWORK_ERROR_PATTERN.test(error.message) ? '连接网络后可用' : error.message;
  }

  return fallback;
}
