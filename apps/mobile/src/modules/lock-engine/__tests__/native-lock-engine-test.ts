import { Platform } from 'react-native';
import { createNativeLockEngine } from '../native-lock-engine';

describe('native lock engine focus restrictions', () => {
  beforeAll(() => Object.defineProperty(Platform, 'OS', { value: 'android' }));

  test('returns the native result for a whitelist session', async () => {
    const applyFocusRestrictionSessionV2 = jest.fn(async () => ({
      supported: true,
      effective: true,
      reason: null,
    }));
    const engine = createNativeLockEngine(() => ({ applyFocusRestrictionSessionV2 }));

    const result = await engine.applyFocusRestrictions({
      sessionId: 'focus-1',
      taskTitle: '复习数学错题',
      restrictionMode: 'whitelist',
      hideRecents: false,
      blockLeaving: true,
      blockNotifications: false,
      hideLauncherIcon: false,
      allowedPackages: ['com.example.dictionary'],
      expiresAt: 123_000,
    });

    expect(applyFocusRestrictionSessionV2).toHaveBeenCalledWith({
      sessionId: 'focus-1',
      taskTitle: '复习数学错题',
      restrictionMode: 'whitelist',
      hideRecents: false,
      blockLeaving: true,
      blockNotifications: false,
      hideLauncherIcon: false,
      allowedPackages: ['com.example.dictionary'],
      expiresAt: 123_000,
    });
    expect(result).toEqual({ supported: true, effective: true, reason: null });
  });

  test('keeps old native builds callable', async () => {
    const applyFocusRestrictions = jest.fn(async () => undefined);
    const engine = createNativeLockEngine(() => ({ applyFocusRestrictions }));

    const result = await engine.applyFocusRestrictions({
      hideRecents: false,
      blockLeaving: true,
      blockNotifications: false,
      hideLauncherIcon: false,
      allowedPackages: ['com.example.music'],
      expiresAt: 456_000,
    });

    expect(applyFocusRestrictions).toHaveBeenCalledWith(
      false, true, false, false, ['com.example.music'], 456_000,
    );
    expect(result).toEqual({ supported: true, effective: true, reason: null });
  });

  test('drains privacy-safe native restriction events', async () => {
    const drainFocusRestrictionEvents = jest.fn(async () => ([
      { event: 'app_blocked', props: { sessionId: 'focus-1' }, at: 123_000 },
    ]));
    const engine = createNativeLockEngine(() => ({ drainFocusRestrictionEvents } as never));

    await expect(engine.drainFocusRestrictionEvents()).resolves.toEqual([
      { event: 'app_blocked', props: { sessionId: 'focus-1' }, at: 123_000 },
    ]);
    expect(drainFocusRestrictionEvents).toHaveBeenCalledTimes(1);
  });
});
