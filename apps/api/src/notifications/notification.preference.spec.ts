import { isNotificationTypeEnabled } from './notification.preference';

test('family change and anomaly respect familyAlertsEnabled', () => {
  expect(isNotificationTypeEnabled('family_change_request', { familyAlertsEnabled: false })).toBe(false);
  expect(isNotificationTypeEnabled('family_anomaly', { familyAlertsEnabled: true })).toBe(true);
});

test('friend invite and pk use task reminders', () => {
  expect(isNotificationTypeEnabled('friend_invite', { taskRemindersEnabled: false })).toBe(false);
  expect(isNotificationTypeEnabled('pk_started', { taskRemindersEnabled: true })).toBe(true);
});

test('reward uses rewardNotificationsEnabled', () => {
  expect(isNotificationTypeEnabled('reward_available', { rewardNotificationsEnabled: false })).toBe(false);
});
