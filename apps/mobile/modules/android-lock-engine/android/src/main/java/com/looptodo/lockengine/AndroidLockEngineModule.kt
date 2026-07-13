package com.looptodo.lockengine

import android.Manifest
import android.app.AlarmManager
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AndroidLockEngineModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AndroidLockEngine")
    AsyncFunction("checkCapabilities") {
      val context = appContext.reactContext ?: error("Android context unavailable")
      mapOf(
        "supported" to true,
        "manufacturer" to Build.MANUFACTURER.orEmpty(),
        "sdkInt" to Build.VERSION.SDK_INT,
        "vendorBackgroundSettingsAvailable" to (vendorBackgroundComponent()?.let { Intent().setComponent(it).resolveActivity(context.packageManager) } != null),
        "notificationGranted" to (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED),
        "notificationListenerEnabled" to notificationListenerEnabled(context),
        "accessibilityEnabled" to accessibilityEnabled(context),
        "batteryOptimizationIgnored" to (context.getSystemService(PowerManager::class.java)?.isIgnoringBatteryOptimizations(context.packageName) == true),
        "riskConfirmed" to LockState.riskConfirmed(context),
        "emergencyExitsRemaining" to LockState.emergencyRemaining(context),
        "exactAlarmAllowed" to (Build.VERSION.SDK_INT < 31 || context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()),
        "restrictions" to restrictionCapabilities(context)
      )
    }
    AsyncFunction("confirmRisk") { val context = appContext.reactContext ?: error("Android context unavailable"); LockState.confirmRisk(context) }
    AsyncFunction("getActiveSession") { appContext.reactContext?.let { LockState.read(it)?.toMap() } }
    AsyncFunction("scheduleForcedRule") { id: String, sourceId: String, title: String, durationMinutes: Int, dailyMinute: Int, recurring: Boolean ->
      val context = appContext.reactContext ?: error("Android context unavailable")
      require(dailyMinute in 0..1439) { "Daily trigger minute is invalid" }
      require(LockState.riskConfirmed(context)) { "Lock mode risk confirmation is required" }
      if (Build.VERSION.SDK_INT >= 33) require(ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED) { "Notification permission is required" }
      require(notificationListenerEnabled(context)) { "Notification listener permission is required" }
      val existing = ForcedRuleState.get(context, id)
      val rule = if (existing != null && existing.sourceId == sourceId && existing.dailyMinute == dailyMinute && existing.durationMinutes == durationMinutes.coerceIn(1, 180) && existing.recurring == recurring)
        existing.copy(title = title) else ForcedRule(id, sourceId, title, durationMinutes.coerceIn(1, 180), dailyMinute, ForcedRuleState.nextOccurrence(dailyMinute), 0, recurring)
      ForcedRuleState.upsert(context, rule)
    }
    AsyncFunction("cancelForcedRule") { id: String -> appContext.reactContext?.let { ForcedRuleState.cancel(it, id) } }
    AsyncFunction("markForcedRuleSatisfied") { id: String -> appContext.reactContext?.let { ForcedRuleState.satisfyToday(it, id) } }
    AsyncFunction("startLockSession") { id: String, taskId: String, taskTitle: String, endsAt: Double, enhanced: Boolean ->
      val context = appContext.reactContext ?: error("Android context unavailable")
      val end = endsAt.toLong(); val now = System.currentTimeMillis()
      require(end > now && end - now <= 3 * 60 * 60 * 1000) { "Lock duration must be between 1 minute and 3 hours" }
      require(LockState.read(context) == null) { "A lock session is already active" }
      require(LockState.riskConfirmed(context)) { "Lock mode risk confirmation is required" }
      if (Build.VERSION.SDK_INT >= 33) require(ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED) { "Notification permission is required" }
      require(notificationListenerEnabled(context)) { "Notification listener permission is required" }
      if (enhanced) require(accessibilityEnabled(context)) { "Accessibility permission is required for enhanced lock" }
      LockState.write(context, LockSession(id, taskId, taskTitle, now, end, enhanced))
      ContextCompat.startForegroundService(context, Intent(context, LockForegroundService::class.java))
      (appContext.currentActivity ?: context).startActivity(Intent(context, LockActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    AsyncFunction("endLockSession") { id: String -> finish(id) }
    AsyncFunction("emergencyExit") { id: String, reason: String ->
      require(reason.trim().isNotEmpty()) { "Emergency reason is required" }
      val context = appContext.reactContext ?: error("Android context unavailable")
      require(LockState.read(context)?.id == id) { "Lock session does not match" }
      LockState.useEmergency(context); finish(id)
    }
    AsyncFunction("applyFocusRestrictions") { hideRecents: Boolean, blockLeaving: Boolean, blockNotifications: Boolean, hideLauncherIcon: Boolean ->
      val context = appContext.reactContext ?: error("Android context unavailable")
      require(!hideLauncherIcon) { "隐藏桌面图标为实验能力，当前设备未安全启用" }
      if (blockLeaving) require(accessibilityEnabled(context)) { "阻止离开需要开启无障碍增强约束" }
      if (blockNotifications) require(notificationListenerEnabled(context)) { "拦截通知需要开启通知读取权限" }
      if (hideRecents) require(FocusRestrictionState.setExcludedFromRecents(appContext.currentActivity, true)) { "当前窗口无法隐藏最近任务" }
      else FocusRestrictionState.setExcludedFromRecents(appContext.currentActivity, false)
      FocusRestrictionState.write(context, FocusRestrictions(hideRecents, blockLeaving, blockNotifications))
    }
    AsyncFunction("clearFocusRestrictions") {
      val context = appContext.reactContext ?: error("Android context unavailable")
      FocusRestrictionState.setExcludedFromRecents(appContext.currentActivity, false); FocusRestrictionState.clear(context)
    }
    AsyncFunction("openPermissionSettings") { kind: String ->
      val context = appContext.reactContext ?: error("Android context unavailable")
      val intent = when (kind) {
        "accessibility" -> Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        "notificationListener" -> Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
        "exactAlarm" -> Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, android.net.Uri.parse("package:${context.packageName}"))
        "battery" -> Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        "vendorBackground" -> vendorBackgroundIntent(context)
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:${context.packageName}"))
      }
      val safeIntent = if (intent.resolveActivity(context.packageManager) != null) intent
        else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:${context.packageName}"))
      context.startActivity(safeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
  private fun finish(id: String) {
    val context = appContext.reactContext ?: error("Android context unavailable")
    require(LockState.read(context)?.id == id) { "Lock session does not match" }
    LockState.clear(context); FocusRestrictionState.setExcludedFromRecents(appContext.currentActivity, false); FocusRestrictionState.clear(context)
    context.stopService(Intent(context, LockForegroundService::class.java));
    context.sendBroadcast(Intent(LockActivity.ACTION_FINISH).setPackage(context.packageName))
  }
  private fun accessibilityEnabled(context: android.content.Context): Boolean {
    val expected = ComponentName(context, LockAccessibilityService::class.java).flattenToString()
    return Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)?.split(':')?.any { it.equals(expected, true) } == true
  }
  private fun notificationListenerEnabled(context: android.content.Context): Boolean {
    val expected = ComponentName(context, LockNotificationListener::class.java).flattenToString()
    return Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")?.split(':')?.any { it.equals(expected, true) } == true
  }
  private fun restrictionCapabilities(context: android.content.Context): Map<String, Map<String, Any?>> {
    val active = FocusRestrictionState.read(context)
    val accessibility = accessibilityEnabled(context); val notifications = notificationListenerEnabled(context)
    val recentsSupported = FocusRestrictionState.canSetExcludedFromRecents(appContext.currentActivity)
    return mapOf(
      "hideRecents" to mapOf("supported" to recentsSupported, "effective" to FocusRestrictionState.isExcludedFromRecents(appContext.currentActivity), "reason" to (if (recentsSupported) null else "当前窗口无法控制最近任务")),
      "blockLeaving" to mapOf("supported" to accessibility, "effective" to (active.blockLeaving && accessibility), "reason" to (if (accessibility) null else "需要开启无障碍增强约束")),
      "blockNotifications" to mapOf("supported" to notifications, "effective" to (active.blockNotifications && notifications), "reason" to (if (notifications) null else "需要开启通知读取权限")),
      "hideLauncherIcon" to mapOf("supported" to false, "effective" to false, "reason" to "为避免应用无法重新打开，当前版本暂不启用", "experimental" to true)
    )
  }
  private fun vendorBackgroundIntent(context: android.content.Context): Intent {
    return vendorBackgroundComponent()?.let { Intent().setComponent(it) }
      ?: Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:${context.packageName}"))
  }
  private fun vendorBackgroundComponent(): ComponentName? {
    return when (Build.MANUFACTURER.lowercase()) {
      "xiaomi", "redmi" -> ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
      "oppo", "oneplus", "realme" -> ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")
      "vivo", "iqoo" -> ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")
      "huawei" -> ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
      "honor" -> ComponentName("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
      "samsung" -> ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity")
      else -> null
    }
  }
}
