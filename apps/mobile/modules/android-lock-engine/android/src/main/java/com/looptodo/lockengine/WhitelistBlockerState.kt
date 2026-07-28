package com.looptodo.lockengine

import android.content.Context
import android.os.SystemClock

object WhitelistBlockerState {
  private const val FILE = "looptodo_whitelist_blocker"
  private const val DURATION_MS = 3_000L

  fun begin(context: Context, sessionId: String): Long {
    val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    val now = SystemClock.elapsedRealtime()
    val existingSession = preferences.getString("session_id", null)
    val existingDeadline = preferences.getLong("deadline_elapsed", 0L)
    if (existingSession == sessionId && existingDeadline > now) return existingDeadline
    val deadline = now + DURATION_MS
    preferences.edit().putString("session_id", sessionId).putLong("deadline_elapsed", deadline).commit()
    return deadline
  }

  fun deadline(context: Context, sessionId: String): Long? {
    val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    if (preferences.getString("session_id", null) != sessionId) return null
    return preferences.getLong("deadline_elapsed", 0L).takeIf { it > 0L }
  }

  fun clear(context: Context) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().clear().commit()
  }
}
