package com.looptodo.lockengine

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.content.Intent

data class FocusRestrictions(
  val hideRecents: Boolean,
  val blockLeaving: Boolean,
  val blockNotifications: Boolean,
  val allowedPackages: Set<String> = emptySet(),
  // 专注限制的过期时间（epoch millis）。0 表示无过期时间（旧数据或未设置）。
  // 兜底用途：即使 app 进程被杀、再也没被打开，无障碍服务读到已过期的限制会当作无效，从而不再拉回用户。
  val expiresAt: Long = 0L
) {
  // 专注「阻止离开」是否仍有效：开关开着，且（无过期时间或尚未过期）。
  fun blockLeavingActive(now: Long): Boolean = blockLeaving && (expiresAt <= 0L || now < expiresAt)
}

object FocusRestrictionState {
  private const val FILE = "looptodo_focus_restrictions"
  fun read(context: Context): FocusRestrictions {
    val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    return FocusRestrictions(
      preferences.getBoolean("hide_recents", false),
      preferences.getBoolean("block_leaving", false),
      preferences.getBoolean("block_notifications", false),
      // 只在专注模式使用；锁机模式的 LockAccessibilityService 分支忽略该集合。
      preferences.getStringSet("allowed_packages", emptySet())?.toSet() ?: emptySet(),
      preferences.getLong("expires_at", 0L)
    )
  }
  fun write(context: Context, value: FocusRestrictions) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
      .putBoolean("hide_recents", value.hideRecents)
      .putBoolean("block_leaving", value.blockLeaving)
      .putBoolean("block_notifications", value.blockNotifications)
      .putStringSet("allowed_packages", value.allowedPackages)
      .putLong("expires_at", value.expiresAt)
      .commit()
  }
  // 兜底自清：若专注限制已过期，直接清空，避免残留状态永久困住用户。返回是否已清理。
  fun clearIfExpired(context: Context, now: Long): Boolean {
    val expiresAt = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getLong("expires_at", 0L)
    if (expiresAt > 0L && expiresAt <= now) {
      clear(context)
      return true
    }
    return false
  }
  fun clear(context: Context) {
    clearExcludedFromRecents(context)
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().clear().commit()
  }
  fun canSetExcludedFromRecents(activity: Activity?): Boolean = findAppTask(activity) != null
  fun isExcludedFromRecents(activity: Activity?): Boolean {
    val task = findAppTask(activity) ?: return false
    return task.taskInfo.baseIntent.flags and Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS != 0
  }
  fun setExcludedFromRecents(activity: Activity?, excluded: Boolean): Boolean {
    val task = findAppTask(activity) ?: return false
    task.setExcludeFromRecents(excluded)
    return isExcludedFromRecents(activity) == excluded
  }
  fun clearExcludedFromRecents(context: Context) {
    val tasks = findLauncherTasks(context)
    tasks.forEach { it.setExcludeFromRecents(false) }
  }
  fun hasExcludedFromRecentsTask(context: Context): Boolean = findLauncherTasks(context).any {
    it.taskInfo.baseIntent.flags and Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS != 0
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
