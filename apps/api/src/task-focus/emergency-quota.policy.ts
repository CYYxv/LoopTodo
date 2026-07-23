export const MONTHLY_EMERGENCY_EXIT_LIMIT = 2;

export function emergencyYearMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthRangeUtc(date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}

export function remainingEmergencyExits(used: number, limit = MONTHLY_EMERGENCY_EXIT_LIMIT): number {
  return Math.max(0, limit - Math.max(0, Math.floor(used)));
}
