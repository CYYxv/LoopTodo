declare const __dirname: string;

const fs = require('fs');
const path = require('path');

const mobileRoot = path.resolve(__dirname, '../../../..');
const nativeRoot = path.join(
  mobileRoot,
  'modules/android-lock-engine/android/src/main/java/com/looptodo/lockengine',
);

const read = (name: string) => fs.readFileSync(path.join(nativeRoot, name), 'utf8');

describe('Android whitelist runtime reliability', () => {
  test('waits for a persisted service-ready acknowledgement', () => {
    const moduleSource = read('AndroidLockEngineModule.kt');
    const stateSource = read('FocusRestrictionState.kt');

    expect(moduleSource).toContain('startAndAwaitFocusRuntime');
    expect(moduleSource).toContain('FocusRuntimeStatus.READY');
    expect(stateSource).toContain('FocusRuntimeStatus.STARTING');
    expect(stateSource).toContain('FocusRuntimeStatus.READY');
    expect(stateSource).toContain('FocusRuntimeStatus.INVALID');
  });

  test('checks Xiaomi background launch independently from overlay permission', () => {
    const moduleSource = read('AndroidLockEngineModule.kt');

    expect(moduleSource).toContain('miuiBackgroundLaunchEnabled(context)');
    expect(moduleSource).toContain('PermissionsEditorActivity');
    expect(moduleSource).not.toContain('"backgroundLaunch" to capability(true, overlay');
    expect(moduleSource).not.toContain('AutoStartManagementActivity');
  });

  test('allows other vendors to proceed to the runtime activity probe after overlay permission', () => {
    const moduleSource = read('AndroidLockEngineModule.kt');

    expect(moduleSource).toContain('backgroundLaunchCapability(context)');
    expect(moduleSource).not.toContain('if (isXiaomiDevice()) miuiBackgroundLaunchEnabled(context) else overlay');
    expect(moduleSource).toContain('effective = overlayGranted');
    expect(moduleSource).not.toContain('无法可靠确认后台弹出能力');
  });

  test('recovers the current foreground package when no new resume event exists', () => {
    const serviceSource = read('LockForegroundService.kt');

    expect(serviceSource).toContain('queryUsageStats(');
    expect(serviceSource).toContain('selectForegroundPackage(');
    expect(serviceSource).toContain('FOREGROUND_FALLBACK_WINDOW_MS');
  });

  test('uses the active blocker deadline as a service-side Home and Recent recovery path', () => {
    const serviceSource = read('LockForegroundService.kt');

    expect(serviceSource).toContain('WhitelistBlockerState.deadline(');
    expect(serviceSource).toContain('shouldRefocusBlocker(');
    expect(serviceSource).toContain('restrictionRuntime.launchBlocker(restrictions.sessionId)');
  });

  test('waits for an invisible activity launch probe before acknowledging ready', () => {
    const serviceSource = read('LockForegroundService.kt');
    const runtimeSource = read('FocusRestrictionRuntime.kt');

    expect(runtimeSource).toContain('FocusRestrictionProbeActivity::class.java');
    expect(runtimeSource).toContain('launchReadinessProbe(');
    expect(serviceSource).toContain('READINESS_PROBE_TIMEOUT_MS');
    expect(serviceSource).toContain('FocusRuntimeStatus.READY');
  });

  test('checks runtime permissions continuously and persists invalidation', () => {
    const serviceSource = read('LockForegroundService.kt');
    const runtimeSource = read('FocusRestrictionRuntime.kt');

    expect(serviceSource).toContain('validatePermissions(restrictions)');
    expect(serviceSource).toContain('ACTION_FOCUS_RESTRICTION_INVALIDATED');
    expect(serviceSource).not.toContain('runCatching { startActivity(intent) }');
    expect(serviceSource).toContain('BLOCKER_FAILURE_LIMIT');
    expect(serviceSource).toContain('restrictionRuntime.invalidate(');
    expect(runtimeSource).toContain('fun invalidate(restrictions: FocusRestrictions, reason: String)');
    expect(runtimeSource).toContain('backgroundLaunchCapability(context)');
    expect(runtimeSource).toContain('需要在系统设置允许后台弹出界面');
  });

  test('protects system foreground flows and does not show over keyguard', () => {
    const serviceSource = read('LockForegroundService.kt');
    const activitySource = read('WhitelistBlockedActivity.kt');
    const runtimeSource = read('FocusRestrictionRuntime.kt');

    expect(serviceSource).toContain('shouldBlockForeground');
    expect(serviceSource).toContain('SystemForegroundSafety');
    expect(activitySource).toContain('SystemForegroundSafety');
    expect(activitySource).not.toContain('FLAG_SHOW_WHEN_LOCKED');
    expect(runtimeSource).not.toContain('"com.android.settings"');
  });

  test('clears elapsed realtime blocker state on boot', () => {
    expect(read('BootReceiver.kt')).toContain('WhitelistBlockerState.clear(context)');
  });

  test('preserves a persisted invalid state during late service cleanup and recovery checks', () => {
    const moduleSource = read('AndroidLockEngineModule.kt');
    const serviceSource = read('LockForegroundService.kt');

    expect(moduleSource).toContain('runtime.status == FocusRuntimeStatus.INVALID');
    expect(serviceSource).toContain('runtime.status != FocusRuntimeStatus.INVALID');
  });

  test('returns launchable enabled apps with icons and protected-package exclusions', () => {
    const moduleSource = read('AndroidLockEngineModule.kt');
    const appsSource = read('LaunchableApps.kt');

    expect(moduleSource).toContain('resolveLaunchableApps(context)');
    expect(appsSource).toContain('"iconDataUrl"');
    expect(appsSource).not.toMatch(/"icon"\s+to/);
    expect(appsSource).toContain('InputMethodManager');
    expect(appsSource).toContain('Intent.CATEGORY_HOME');
  });

  test('persists and drains privacy-safe blocker analytics', () => {
    const moduleSource = read('AndroidLockEngineModule.kt');
    const serviceSource = read('LockForegroundService.kt');
    const activitySource = read('WhitelistBlockedActivity.kt');
    const analyticsSource = read('RestrictionAnalyticsStore.kt');

    expect(moduleSource).toContain('drainFocusRestrictionEvents');
    expect(serviceSource).toContain('recordBlocked');
    expect(activitySource).toContain('recordBlockerShown');
    expect(activitySource).toContain('recordBlockerRefocused');
    expect(analyticsSource).toContain('BLOCK_DEBOUNCE_MS');
    expect(analyticsSource).not.toContain('"packageName"');
    expect(analyticsSource).not.toContain('"appName"');
  });
});
