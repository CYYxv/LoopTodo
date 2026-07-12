import { isReactionEmoji, socialPairKey } from './social.policy';

test('friend and PK pair keys are direction independent', () => { expect(socialPairKey('b', 'a')).toBe(socialPairKey('a', 'b')); });
test('study rooms accept only motivational reactions', () => { expect(isReactionEmoji('🔥')).toBe(true); expect(isReactionEmoji('hello')).toBe(false); });
