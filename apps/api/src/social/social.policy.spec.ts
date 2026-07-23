import { competitiveFocusMinutes, isReactionEmoji, socialPairKey } from './social.policy';

test('friend and PK pair keys are direction independent', () => {
  expect(socialPairKey('b', 'a')).toBe(socialPairKey('a', 'b'));
});

test('study rooms accept only motivational reactions', () => {
  expect(isReactionEmoji('🔥')).toBe(true);
  expect(isReactionEmoji('hello')).toBe(false);
});

test('PK competitive minutes weight lock higher than whitelist', () => {
  expect(competitiveFocusMinutes([
    { durationMinutes: 40, trustLevel: 'open' },
    { durationMinutes: 40, trustLevel: 'high' },
  ])).toBe(100);
});
