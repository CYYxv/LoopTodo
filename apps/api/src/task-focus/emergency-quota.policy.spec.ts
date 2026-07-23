import { emergencyYearMonth, remainingEmergencyExits, MONTHLY_EMERGENCY_EXIT_LIMIT } from './emergency-quota.policy';

test('monthly limit is two', () => {
  expect(MONTHLY_EMERGENCY_EXIT_LIMIT).toBe(2);
  expect(remainingEmergencyExits(0)).toBe(2);
  expect(remainingEmergencyExits(1)).toBe(1);
  expect(remainingEmergencyExits(2)).toBe(0);
  expect(remainingEmergencyExits(5)).toBe(0);
});

test('year month is UTC YYYY-MM', () => {
  expect(emergencyYearMonth(new Date(Date.UTC(2026, 6, 23)))).toBe('2026-07');
});
