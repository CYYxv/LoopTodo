package com.looptodo.lockengine

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.content.Intent

data class FocusRestrictions(val hideRecents: Boolean, val blockLeaving: Boolean, val blockNotifications: Boolean)

object FocusRestrictionState {
  private const val FILE = "looptodo_focus_restrictions"
  fun read(context: Context): FocusRestrictions {
    val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    return FocusRestrictions(preferences.getBoolean("hide_recents", false), preferences.getBoolean("block_leaving", false), preferences.getBoolean("block_notifications", false))
  }
  fun write(context: Context, value: FocusRestrictions) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
      .putBoolean("hide_recents", value.hideRecents)
      .putBoolean("block_leaving", value.blockLeaving)
      .putBoolean("block_notifications", value.blockNotifications)
      .commit()
  }
  fun clear(context: Context) { context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().clear().commit() }
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
  private fun findAppTask(activity: Activity?): ActivityManager.AppTask? {
    if (activity == null) return null
    val manager = activity.getSystemService(ActivityManager::class.java) ?: return null
    return manager.appTasks.firstOrNull { it.taskInfo.taskId == activity.taskId }
  }
}
