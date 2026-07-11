package com.looptodo.lockengine

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import android.util.Log

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
      if (LockState.read(context) != null) ContextCompat.startForegroundService(context, Intent(context, LockForegroundService::class.java))
      try { ForcedRuleState.scheduleAll(context) }
      catch (error: SecurityException) { Log.e("LoopTodoLock", "Unable to restore exact forced alarms", error) }
    }
  }
}
