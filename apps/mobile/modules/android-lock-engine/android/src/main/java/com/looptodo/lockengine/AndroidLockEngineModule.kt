package com.looptodo.lockengine

import android.Manifest
import android.app.AlarmManager
import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class AndroidLockEngineModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AndroidLockEngine")
    AsyncFunction("checkCapabilities") {
      val context = appContext.reactContext ?: error("Android context unavailable")
      recoverRuntime(context)
      val usageAccess = usageAccessEnabled(context)
      val overlay = overlayEnabled(context)
      val vendorBackgroundSettingsAvailable = vendorBackgroundComponent()?.let {
        Intent().setComponent(it).resolveActivity(context.packageManager)
      } != null
      val backgroundLaunch = backgroundLaunchCapability(context)
      mapOf(
        "supported" to true,
        "manufacturer" to Build.MANUFACTURER.orEmpty(),
        "sdkInt" to Build.VERSION.SDK_INT,
        "vendorBackgroundSettingsAvailable" to vendorBackgroundSettingsAvailable,
        "notificationGranted" to (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED),
        "notificationListenerEnabled" to notificationListenerEnabled(context),
        "accessibilityEnabled" to false,
        "usageAccess" to capability(true, usageAccess, if (usageAccess) null else "需要允许查看应用使用情况"),
        "overlay" to capability(Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(context), overlay, if (overlay) null else "需要允许显示在其他应用上层"),
        "backgroundLaunch" to capability(
          backgroundLaunch.supported,
          backgroundLaunch.effective,
          backgroundLaunch.reason,
        ),
        "service" to capability(true, FocusRestrictionState.isServiceRunning(context), if (FocusRestrictionState.isServiceRunning(context)) null else "专注前台服务未运行"),
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
      clearFocusRuntime(context)
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
    AsyncFunction("applyFocusRestrictions") Coroutine { hideRecents: Boolean, blockLeaving: Boolean, blockNotifications: Boolean, hideLauncherIcon: Boolean, allowedPackages: List<String>, expiresAt: Double ->
      val context = appContext.reactContext ?: error("Android context unavailable")
      val mode = if (!blockLeaving) FocusRestrictionMode.NONE else if (allowedPackages.isEmpty()) FocusRestrictionMode.STRICT else FocusRestrictionMode.WHITELIST
      applyFocusRestrictionSession(context, "legacy-focus-${expiresAt.toLong()}", "当前专注", mode, hideRecents, blockLeaving, blockNotifications, hideLauncherIcon, allowedPackages, expiresAt.toLong())
    }
    AsyncFunction("applyFocusRestrictionSession") Coroutine { sessionId: String, restrictionMode: String, hideRecents: Boolean, blockLeaving: Boolean, blockNotifications: Boolean, hideLauncherIcon: Boolean, allowedPackages: List<String>, expiresAt: Double ->
      val context = appContext.reactContext ?: error("Android context unavailable")
      applyFocusRestrictionSession(context, sessionId, "当前专注", FocusRestrictionMode.from(restrictionMode), hideRecents, blockLeaving, blockNotifications, hideLauncherIcon, allowedPackages, expiresAt.toLong())
    }
    AsyncFunction("applyFocusRestrictionSessionV2") Coroutine { options: FocusRestrictionSessionOptions ->
      val context = appContext.reactContext ?: error("Android context unavailable")
      applyFocusRestrictionSession(
        context,
        options.sessionId,
        options.taskTitle,
        FocusRestrictionMode.from(options.restrictionMode),
        options.hideRecents,
        options.blockLeaving,
        options.blockNotifications,
        options.hideLauncherIcon,
        options.allowedPackages,
        options.expiresAt.toLong(),
      )
    }
    AsyncFunction("listLaunchableApps") {
      val context = appContext.reactContext ?: error("Android context unavailable")
      resolveLaunchableApps(context)
    }
    AsyncFunction("clearFocusRestrictions") {
      val context = appContext.reactContext ?: error("Android context unavailable")
      clearFocusRuntime(context)
    }
    AsyncFunction("drainFocusRestrictionEvents") {
      val context = appContext.reactContext ?: error("Android context unavailable")
      RestrictionAnalyticsStore.drain(context)
    }
    AsyncFunction("openPermissionSettings") { kind: String ->
      val context = appContext.reactContext ?: error("Android context unavailable")
      val intent = when (kind) {
        "usageAccess" -> Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        "overlay" -> Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse("package:${context.packageName}"))
        "backgroundLaunch", "vendorBackground" -> vendorBackgroundIntent(context)
        "notificationListener" -> Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
        "exactAlarm" -> Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, android.net.Uri.parse("package:${context.packageName}"))
        "battery" -> Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
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
    LockState.clear(context); FocusRestrictionState.clear(context); WhitelistBlockerState.clear(context)
    context.stopService(Intent(context, LockForegroundService::class.java));
    context.sendBroadcast(Intent(LockActivity.ACTION_FINISH).setPackage(context.packageName))
    context.sendBroadcast(Intent(WhitelistBlockedActivity.ACTION_FINISH).setPackage(context.packageName))
  }
  private fun notificationListenerEnabled(context: android.content.Context): Boolean {
    val expected = ComponentName(context, LockNotificationListener::class.java).flattenToString()
    return Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")?.split(':')?.any { it.equals(expected, true) } == true
  }
  private fun restrictionCapabilities(context: android.content.Context): Map<String, Map<String, Any?>> {
    val active = FocusRestrictionState.read(context)
    val runtime = FocusRestrictionState.runtimeState(context)
    val available = usageAccessEnabled(context) && overlayEnabled(context)
    val notifications = notificationListenerEnabled(context)
    val recentsSupported = FocusRestrictionState.canSetExcludedFromRecents(appContext.currentActivity)
    val runtimeReason = runtime.reason.takeIf { runtime.status == FocusRuntimeStatus.INVALID }
    return mapOf(
      "hideRecents" to mapOf("supported" to recentsSupported, "effective" to FocusRestrictionState.hasExcludedFromRecentsTask(context), "reason" to (if (recentsSupported) null else "当前窗口无法控制最近任务")),
      "blockLeaving" to mapOf("supported" to available, "effective" to (active.isActive(System.currentTimeMillis()) && available && FocusRestrictionState.isServiceRunning(context)), "reason" to (runtimeReason ?: if (available) null else "需要使用情况访问和上层显示权限")),
      "whitelist" to mapOf("supported" to available, "effective" to (active.mode == FocusRestrictionMode.WHITELIST && active.isActive(System.currentTimeMillis()) && available && FocusRestrictionState.isServiceRunning(context)), "reason" to (runtimeReason ?: if (available) null else "需要使用情况访问和上层显示权限")),
      "blockNotifications" to mapOf("supported" to notifications, "effective" to (active.blockNotifications && notifications), "reason" to (if (notifications) null else "需要开启通知读取权限")),
      "hideLauncherIcon" to mapOf("supported" to false, "effective" to false, "reason" to "为避免应用无法重新打开，当前版本暂不启用", "experimental" to true)
    )
  }
  private suspend fun applyFocusRestrictionSession(
    context: android.content.Context,
    sessionId: String,
    taskTitle: String,
    mode: FocusRestrictionMode,
    hideRecents: Boolean,
    blockLeaving: Boolean,
    blockNotifications: Boolean,
    hideLauncherIcon: Boolean,
    allowedPackages: List<String>,
    expiresAt: Long
  ): Map<String, Any?> {
    require(!hideLauncherIcon) { "隐藏桌面图标为实验能力，当前设备未安全启用" }
    if (mode == FocusRestrictionMode.NONE) {
      clearFocusRuntime(context)
      return capability(true, false, null)
    }
    if (LockState.read(context) != null) {
      clearFocusRuntime(context)
      return capability(true, false, "锁机模式忽略普通软件白名单")
    }
    if (sessionId.isBlank() || expiresAt <= System.currentTimeMillis()) {
      clearFocusRuntime(context)
      return capability(true, false, "专注会话无效或已过期")
    }
    if (!usageAccessEnabled(context)) {
      clearFocusRuntime(context)
      return capability(true, false, "需要允许查看应用使用情况")
    }
    if (!overlayEnabled(context)) {
      clearFocusRuntime(context)
      return capability(true, false, "需要允许显示在其他应用上层")
    }
    if (blockNotifications && !notificationListenerEnabled(context)) {
      clearFocusRuntime(context)
      return capability(true, false, "需要开启通知读取权限")
    }
    if (hideRecents && !FocusRestrictionState.setExcludedFromRecents(appContext.currentActivity, true)) {
      clearFocusRuntime(context)
      return capability(true, false, "当前窗口无法隐藏最近任务")
    }
    if (!hideRecents) FocusRestrictionState.clearExcludedFromRecents(context)
    val allowed = if (mode == FocusRestrictionMode.STRICT) emptySet() else allowedPackages.filter { it.isNotBlank() }.toSet()
    FocusRestrictionState.write(context, FocusRestrictions(sessionId, taskTitle.trim().ifBlank { "当前专注" }, mode, hideRecents, blockLeaving, blockNotifications, allowed, expiresAt))
    val state = startAndAwaitFocusRuntime(
      context = context,
      sessionId = sessionId,
      startService = { ContextCompat.startForegroundService(context, Intent(context, LockForegroundService::class.java)) },
      stopService = { context.stopService(Intent(context, LockForegroundService::class.java)) },
    )
    return capability(true, state.status == FocusRuntimeStatus.READY, state.reason)
  }
  private fun clearFocusRuntime(context: android.content.Context) {
    FocusRestrictionState.clear(context)
    WhitelistBlockerState.clear(context)
    context.sendBroadcast(Intent(WhitelistBlockedActivity.ACTION_FINISH).setPackage(context.packageName))
    if (LockState.read(context) == null) context.stopService(Intent(context, LockForegroundService::class.java))
  }
  private fun recoverRuntime(context: android.content.Context) {
    val lockSession = LockState.read(context)
    val runtime = FocusRestrictionState.runtimeState(context)
    val restrictions = if (lockSession == null) FocusRestrictionState.readActive(context) else null
    if (lockSession != null) FocusRestrictionState.clear(context)
    if (lockSession != null) ContextCompat.startForegroundService(context, Intent(context, LockForegroundService::class.java))
    else if (runtime.status == FocusRuntimeStatus.INVALID) {
      WhitelistBlockerState.clear(context)
      context.sendBroadcast(Intent(WhitelistBlockedActivity.ACTION_FINISH).setPackage(context.packageName))
      context.stopService(Intent(context, LockForegroundService::class.java))
    }
    else if (restrictions != null) {
      if (!FocusRestrictionState.isServiceRunning(context)) {
        FocusRestrictionState.markStarting(context, restrictions.sessionId)
        ContextCompat.startForegroundService(context, Intent(context, LockForegroundService::class.java))
      }
    }
    else clearFocusRuntime(context)
  }
  private fun capability(supported: Boolean, effective: Boolean, reason: String?): Map<String, Any?> =
    mapOf("supported" to supported, "effective" to effective, "reason" to reason)
  private fun vendorBackgroundIntent(context: android.content.Context): Intent {
    return vendorBackgroundComponent()?.let {
      Intent().setComponent(it).putExtra("extra_pkgname", context.packageName).putExtra("package_name", context.packageName)
    }
      ?: Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:${context.packageName}"))
  }
}

internal class FocusRestrictionSessionOptions : Record {
  @Field var sessionId: String = ""
  @Field var taskTitle: String = ""
  @Field var restrictionMode: String = "none"
  @Field var hideRecents: Boolean = false
  @Field var blockLeaving: Boolean = false
  @Field var blockNotifications: Boolean = false
  @Field var hideLauncherIcon: Boolean = false
  @Field var allowedPackages: List<String> = emptyList()
  @Field var expiresAt: Double = 0.0
}

internal data class BackgroundLaunchCapability(
  val supported: Boolean,
  val effective: Boolean,
  val reason: String?,
)

internal fun backgroundLaunchCapability(
  context: android.content.Context,
  manufacturer: String = Build.MANUFACTURER.orEmpty(),
  overlayGranted: Boolean = overlayEnabled(context),
): BackgroundLaunchCapability {
  if (!isXiaomiDevice(manufacturer)) {
    return BackgroundLaunchCapability(
      supported = true,
      effective = overlayGranted,
      reason = if (overlayGranted) null else "需要允许显示在其他应用上层",
    )
  }
  val settingsAvailable = vendorBackgroundComponent(manufacturer)?.let {
    Intent().setComponent(it).resolveActivity(context.packageManager)
  } != null
  val effective = settingsAvailable && miuiBackgroundLaunchEnabled(context)
  return BackgroundLaunchCapability(
    supported = settingsAvailable,
    effective = effective,
    reason = if (effective) null else "需要在系统设置允许后台弹出界面",
  )
}

private fun vendorBackgroundComponent(manufacturer: String = Build.MANUFACTURER.orEmpty()): ComponentName? {
  return when (manufacturer.lowercase()) {
    "xiaomi", "redmi" -> ComponentName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity")
    "oppo", "oneplus", "realme" -> ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")
    "vivo", "iqoo" -> ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")
    "huawei" -> ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
    "honor" -> ComponentName("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
    "samsung" -> ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity")
    else -> null
  }
}

private fun isXiaomiDevice(manufacturer: String = Build.MANUFACTURER.orEmpty()): Boolean =
  manufacturer.lowercase() in setOf("xiaomi", "redmi")

private fun miuiBackgroundLaunchEnabled(context: android.content.Context): Boolean {
  if (!isXiaomiDevice()) return false
  val manager = context.getSystemService(AppOpsManager::class.java) ?: return false
  return runCatching {
    val method = AppOpsManager::class.java.getMethod(
      "checkOpNoThrow",
      Integer.TYPE,
      Integer.TYPE,
      String::class.java,
    )
    method.invoke(manager, MIUI_BACKGROUND_START_ACTIVITY_OP, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
  }.getOrDefault(false)
}

private const val MIUI_BACKGROUND_START_ACTIVITY_OP = 10021
