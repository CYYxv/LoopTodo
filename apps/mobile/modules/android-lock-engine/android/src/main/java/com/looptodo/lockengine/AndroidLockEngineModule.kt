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
        "notificationGranted" to (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED),
        "notificationListenerEnabled" to notificationListenerEnabled(context),
        "accessibilityEnabled" to accessibilityEnabled(context),
        "batteryOptimizationIgnored" to (context.getSystemService(PowerManager::class.java)?.isIgnoringBatteryOptimizations(context.packageName) == true),
        "riskConfirmed" to LockState.riskConfirmed(context),
        "emergencyExitsRemaining" to LockState.emergencyRemaining(context),
        "exactAlarmAllowed" to (Build.VERSION.SDK_INT < 31 || context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms())
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
    AsyncFunction("openPermissionSettings") { kind: String ->
      val context = appContext.reactContext ?: error("Android context unavailable")
      val intent = when (kind) {
        "accessibility" -> Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        "notificationListener" -> Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
        "exactAlarm" -> Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, android.net.Uri.parse("package:${context.packageName}"))
        "battery" -> Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:${context.packageName}"))
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
  private fun finish(id: String) {
    val context = appContext.reactContext ?: error("Android context unavailable")
    require(LockState.read(context)?.id == id) { "Lock session does not match" }
    LockState.clear(context); context.stopService(Intent(context, LockForegroundService::class.java));
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
}
