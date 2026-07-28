package com.looptodo.lockengine

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import android.util.Log

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
      WhitelistBlockerState.clear(context)
      context.sendBroadcast(Intent(WhitelistBlockedActivity.ACTION_FINISH).setPackage(context.packageName))
      val lockSession = LockState.read(context)
      val focusRestrictions = if (lockSession == null) FocusRestrictionState.readActive(context) else null
      if (lockSession != null || focusRestrictions != null) {
        if (focusRestrictions != null) FocusRestrictionState.markStarting(context, focusRestrictions.sessionId)
        try {
          ContextCompat.startForegroundService(context, Intent(context, LockForegroundService::class.java))
        } catch (error: RuntimeException) {
          if (focusRestrictions != null) FocusRestrictionState.invalidate(
            context,
            focusRestrictions.sessionId,
            error.message ?: "重启后无法恢复专注前台服务",
          )
          Log.e("LoopTodoLock", "Unable to restore foreground runtime after boot", error)
        }
      } else {
        FocusRestrictionState.clear(context)
      }
      try { ForcedRuleState.scheduleAll(context) }
      catch (error: SecurityException) { Log.e("LoopTodoLock", "Unable to restore exact forced alarms", error) }
    }
  }
}
