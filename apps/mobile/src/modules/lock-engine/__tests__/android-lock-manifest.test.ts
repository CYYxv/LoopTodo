declare const __dirname: string;

const fs = require('fs');
const path = require('path');

const mobileRoot = path.resolve(__dirname, '../../../..');
const manifestPath = path.join(
  mobileRoot,
  'modules/android-lock-engine/android/src/main/AndroidManifest.xml',
);
const nativeSourceRoot = path.join(
  mobileRoot,
  'modules/android-lock-engine/android/src/main/java',
);
const foregroundServicePath = path.join(
  nativeSourceRoot,
  'com/looptodo/lockengine/LockForegroundService.kt',
);
const generatedAppManifestPath = path.join(mobileRoot, 'android/app/src/main/AndroidManifest.xml');

function readKotlinSources(directory: string): string {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .map((entry: { isDirectory(): boolean; name: string }) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? readKotlinSources(entryPath) : fs.readFileSync(entryPath, 'utf8');
    })
    .join('\n');
}

describe('Android lock engine manifest', () => {
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  const appConfig = JSON.parse(fs.readFileSync(path.join(mobileRoot, 'app.json'), 'utf8'));

  test.each([
    'android.permission.PACKAGE_USAGE_STATS',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.FOREGROUND_SERVICE',
  ])('declares %s', (permission) => {
    expect(manifest).toContain(`android:name="${permission}"`);
  });

  test('registers a single-task immersive whitelist blocker activity', () => {
    const activity = manifest.match(
      /<activity\s+[^>]*android:name="\.WhitelistBlockedActivity"[^>]*\/>/s,
    )?.[0];

    expect(activity).toBeDefined();
    expect(activity).toContain('android:launchMode="singleTask"');
    expect(activity).toContain('android:excludeFromRecents="true"');
    expect(activity).toContain('android:exported="false"');
    expect(activity).toContain('android:taskAffinity="${applicationId}.whitelist.blocker"');
    expect(activity).toContain('android:theme="@style/WhitelistBlockedTheme"');
  });

  test('registers a non-visible internal activity launch probe', () => {
    const activity = manifest.match(
      /<activity\s+[^>]*android:name="\.FocusRestrictionProbeActivity"[^>]*\/>/s,
    )?.[0];

    expect(activity).toBeDefined();
    expect(activity).toContain('android:exported="false"');
    expect(activity).toContain('android:excludeFromRecents="true"');
    expect(activity).toContain('android:noHistory="true"');
    expect(activity).toContain('android:theme="@android:style/Theme.NoDisplay"');
  });

  test('does not register or request an accessibility service', () => {
    const nativeSources = readKotlinSources(nativeSourceRoot);

    expect(manifest).not.toContain('LockAccessibilityService');
    expect(manifest).not.toContain('android.permission.BIND_ACCESSIBILITY_SERVICE');
    expect(manifest).not.toContain('android.accessibilityservice.AccessibilityService');
    expect(manifest).not.toContain('lock_accessibility_service');
    expect(nativeSources).not.toContain('LockAccessibilityService');
    expect(nativeSources).not.toContain('ACTION_ACCESSIBILITY_SETTINGS');
  });

  test('does not block overlay permission in Expo config', () => {
    const generatedAppManifest = fs.readFileSync(generatedAppManifestPath, 'utf8');

    expect(appConfig.expo.android.blockedPermissions).not.toContain(
      'android.permission.SYSTEM_ALERT_WINDOW',
    );
    expect(generatedAppManifest).not.toMatch(
      /android\.permission\.SYSTEM_ALERT_WINDOW[^>]*tools:node="remove"/,
    );
  });

  test('clears focus and blocker state when the foreground runtime stops', () => {
    const source = fs.readFileSync(foregroundServicePath, 'utf8');
    const stopRuntime = source.match(/private fun stopRuntime\(\) \{([\s\S]*?)\n  \}/)?.[1];

    expect(stopRuntime).toContain('FocusRestrictionState.clear(this)');
    expect(stopRuntime).toContain('WhitelistBlockerState.clear(this)');
  });
});
