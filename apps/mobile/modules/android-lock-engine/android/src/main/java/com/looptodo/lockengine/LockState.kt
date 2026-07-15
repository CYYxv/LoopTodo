package com.looptodo.lockengine

import android.content.Context
import org.json.JSONObject
import java.util.Calendar

data class LockSession(val id: String, val taskId: String, val taskTitle: String, val startedAt: Long, val endsAt: Long, val enhanced: Boolean) {
  fun toMap() = mapOf("id" to id, "taskId" to taskId, "taskTitle" to taskTitle, "startedAt" to startedAt, "endsAt" to endsAt, "enhanced" to enhanced)
}

object LockState {
  private const val FILE = "looptodo_lock_state"
  private const val SESSION = "active_session"
  private const val RISK_CONFIRMED = "risk_confirmed"
  private const val EMERGENCY_MONTH = "emergency_month"
  private const val EMERGENCY_COUNT = "emergency_count"
  fun read(context: Context): LockSession? {
    val raw = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(SESSION, null) ?: return null
    val json = JSONObject(raw)
    val session = LockSession(json.getString("id"), json.getString("taskId"), json.getString("taskTitle"), json.getLong("startedAt"), json.getLong("endsAt"), json.getBoolean("enhanced"))
    if (session.endsAt <= System.currentTimeMillis()) {
      clear(context)
      FocusRestrictionState.clear(context)
      return null
    }
    return session
  }
  fun write(context: Context, session: LockSession) {
    val json = JSONObject(session.toMap())
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(SESSION, json.toString()).commit()
  }
  fun clear(context: Context) { context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().remove(SESSION).commit() }
  fun riskConfirmed(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(RISK_CONFIRMED, false)
  fun confirmRisk(context: Context) { context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(RISK_CONFIRMED, true).commit() }
  fun emergencyRemaining(context: Context): Int {
    val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE); val month = monthKey()
    return if (preferences.getString(EMERGENCY_MONTH, null) == month) (2 - preferences.getInt(EMERGENCY_COUNT, 0)).coerceAtLeast(0) else 2
  }
  fun useEmergency(context: Context) {
    val remaining = emergencyRemaining(context); require(remaining > 0) { "Monthly emergency exits are exhausted" }
    val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE); val month = monthKey()
    val count = if (preferences.getString(EMERGENCY_MONTH, null) == month) preferences.getInt(EMERGENCY_COUNT, 0) else 0
    preferences.edit().putString(EMERGENCY_MONTH, month).putInt(EMERGENCY_COUNT, count + 1).commit()
  }
  private fun monthKey(): String { val calendar = Calendar.getInstance(); return "${calendar.get(Calendar.YEAR)}-${calendar.get(Calendar.MONTH) + 1}" }
}
