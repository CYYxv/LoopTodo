package com.looptodo.lockengine

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.os.SystemClock

enum class FocusRestrictionMode(val value: String) {
  NONE("none"),
  WHITELIST("whitelist"),
  STRICT("strict");

  companion object {
    fun from(value: String?): FocusRestrictionMode = entries.firstOrNull { it.value == value } ?: NONE
  }
}

enum class FocusRuntimeStatus(val value: String) {
  STOPPED("stopped"),
  STARTING("starting"),
  READY("ready"),
  INVALID("invalid");

  companion object {
    fun from(value: String?): FocusRuntimeStatus = entries.firstOrNull { it.value == value } ?: STOPPED
  }
}

data class FocusRuntimeState(
  val sessionId: String = "",
  val status: FocusRuntimeStatus = FocusRuntimeStatus.STOPPED,
  val reason: String? = null,
  val heartbeatElapsed: Long = 0L,
)

data class FocusRestrictions(
  val sessionId: String = "",
  val taskTitle: String = "",
  val mode: FocusRestrictionMode = FocusRestrictionMode.NONE,
  val hideRecents: Boolean = false,
  val blockLeaving: Boolean = false,
  val blockNotifications: Boolean = false,
  val allowedPackages: Set<String> = emptySet(),
  val expiresAt: Long = 0L,
) {
  fun isActive(now: Long): Boolean =
    sessionId.isNotBlank() && mode != FocusRestrictionMode.NONE && expiresAt > now

  fun allows(packageName: String, ownPackage: String, systemPackages: Set<String>): Boolean {
    if (packageName == ownPackage || packageName in systemPackages) return true
    return mode == FocusRestrictionMode.WHITELIST && packageName in allowedPackages
  }
}

object FocusRestrictionState {
  private const val FILE = "looptodo_focus_restrictions"
  private const val RUNTIME_FILE = "looptodo_focus_runtime"

  fun read(context: Context): FocusRestrictions {
    val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    return FocusRestrictions(
      sessionId = preferences.getString("session_id", "").orEmpty(),
      taskTitle = preferences.getString("task_title", "").orEmpty(),
      mode = FocusRestrictionMode.from(preferences.getString("restriction_mode", null)),
      hideRecents = preferences.getBoolean("hide_recents", false),
      blockLeaving = preferences.getBoolean("block_leaving", false),
      blockNotifications = preferences.getBoolean("block_notifications", false),
      allowedPackages = preferences.getStringSet("allowed_packages", emptySet())?.toSet() ?: emptySet(),
      expiresAt = preferences.getLong("expires_at", 0L),
    )
  }

  fun readActive(context: Context, now: Long = System.currentTimeMillis()): FocusRestrictions? {
    val restrictions = read(context)
    if (restrictions.isActive(now)) return restrictions
    if (restrictions.sessionId.isNotBlank() || restrictions.mode != FocusRestrictionMode.NONE) clear(context)
    return null
  }

  fun write(context: Context, value: FocusRestrictions) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
      .putString("session_id", value.sessionId)
      .putString("task_title", value.taskTitle)
      .putString("restriction_mode", value.mode.value)
      .putBoolean("hide_recents", value.hideRecents)
      .putBoolean("block_leaving", value.blockLeaving)
      .putBoolean("block_notifications", value.blockNotifications)
      .putStringSet("allowed_packages", value.allowedPackages)
      .putLong("expires_at", value.expiresAt)
      .commit()
    markStarting(context, value.sessionId)
  }

  fun runtimeState(context: Context): FocusRuntimeState {
    val preferences = context.getSharedPreferences(RUNTIME_FILE, Context.MODE_PRIVATE)
    return FocusRuntimeState(
      sessionId = preferences.getString("session_id", "").orEmpty(),
      status = FocusRuntimeStatus.from(preferences.getString("status", null)),
      reason = preferences.getString("reason", null),
      heartbeatElapsed = preferences.getLong("heartbeat_elapsed", 0L),
    )
  }

  fun markStarting(context: Context, sessionId: String) {
    writeRuntimeState(context, FocusRuntimeState(sessionId, FocusRuntimeStatus.STARTING))
  }

  fun markReady(context: Context, sessionId: String): Boolean {
    val restrictions = read(context)
    val runtime = runtimeState(context)
    if (restrictions.sessionId != sessionId || runtime.sessionId != sessionId || runtime.status != FocusRuntimeStatus.STARTING) return false
    writeRuntimeState(context, FocusRuntimeState(sessionId, FocusRuntimeStatus.READY, heartbeatElapsed = SystemClock.elapsedRealtime()))
    return true
  }

  fun markHeartbeat(context: Context, sessionId: String) {
    val runtime = runtimeState(context)
    if (runtime.sessionId == sessionId && runtime.status == FocusRuntimeStatus.READY) {
      writeRuntimeState(context, runtime.copy(heartbeatElapsed = SystemClock.elapsedRealtime()))
    }
  }

  fun invalidate(context: Context, sessionId: String, reason: String) {
    clearRestrictions(context)
    writeRuntimeState(context, FocusRuntimeState(sessionId, FocusRuntimeStatus.INVALID, reason))
  }

  fun isServiceRunning(context: Context): Boolean {
    val runtime = runtimeState(context)
    val heartbeatAge = SystemClock.elapsedRealtime() - runtime.heartbeatElapsed
    return runtime.status == FocusRuntimeStatus.READY && runtime.heartbeatElapsed > 0L && heartbeatAge in 0..HEARTBEAT_TIMEOUT_MS
  }

  fun clear(context: Context) {
    clearRestrictions(context)
    context.getSharedPreferences(RUNTIME_FILE, Context.MODE_PRIVATE).edit().clear().commit()
  }

  private fun clearRestrictions(context: Context) {
    clearExcludedFromRecents(context)
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().clear().commit()
  }

  private fun writeRuntimeState(context: Context, state: FocusRuntimeState) {
    context.getSharedPreferences(RUNTIME_FILE, Context.MODE_PRIVATE).edit()
      .putString("session_id", state.sessionId)
      .putString("status", state.status.value)
      .putString("reason", state.reason)
      .putLong("heartbeat_elapsed", state.heartbeatElapsed)
      .commit()
  }

  private const val HEARTBEAT_TIMEOUT_MS = 3_000L

  fun canSetExcludedFromRecents(activity: Activity?): Boolean = findAppTask(activity) != null

  fun setExcludedFromRecents(activity: Activity?, excluded: Boolean): Boolean {
    val task = findAppTask(activity) ?: return false
    task.setExcludeFromRecents(excluded)
    return isExcludedFromRecents(activity) == excluded
  }

  fun clearExcludedFromRecents(context: Context) {
    findLauncherTasks(context).forEach { it.setExcludeFromRecents(false) }
  }

  fun hasExcludedFromRecentsTask(context: Context): Boolean = findLauncherTasks(context).any {
    it.taskInfo.baseIntent.flags and Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS != 0
  }

  private fun isExcludedFromRecents(activity: Activity?): Boolean {
    val task = findAppTask(activity) ?: return false
    return task.taskInfo.baseIntent.flags and Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS != 0
  }

  private fun findAppTask(activity: Activity?): ActivityManager.AppTask? {
    if (activity == null) return null
    val manager = activity.getSystemService(ActivityManager::class.java) ?: return null
    return manager.appTasks.firstOrNull { it.taskInfo.taskId == activity.taskId }
  }

  private fun findLauncherTasks(context: Context): List<ActivityManager.AppTask> {
    val manager = context.getSystemService(ActivityManager::class.java) ?: return emptyList()
    val launcher = context.packageManager.getLaunchIntentForPackage(context.packageName)?.component
    return manager.appTasks.filter { task ->
      val info = task.taskInfo
      info.baseIntent.component == launcher || info.baseActivity == launcher || info.origActivity == launcher ||
        info.baseIntent.categories?.contains(Intent.CATEGORY_LAUNCHER) == true
    }
  }
}
