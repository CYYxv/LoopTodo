package com.looptodo.lockengine

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONObject
import java.util.Calendar

data class ForcedRule(val id: String, val sourceId: String, val title: String, val durationMinutes: Int,
  val dailyMinute: Int, val triggerAt: Long, val delayCount: Int, val recurring: Boolean) {
  fun json() = JSONObject().put("id", id).put("sourceId", sourceId).put("title", title).put("durationMinutes", durationMinutes)
    .put("dailyMinute", dailyMinute).put("triggerAt", triggerAt).put("delayCount", delayCount).put("recurring", recurring)
}

object ForcedRuleState {
  private const val FILE = "looptodo_forced_rules"
  private const val RULES = "rules"
  fun list(context: Context): List<ForcedRule> {
    val root = JSONObject(context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(RULES, "{}") ?: "{}")
    return root.keys().asSequence().map { key -> parse(root.getJSONObject(key)) }.toList()
  }
  fun get(context: Context, id: String) = list(context).find { it.id == id }
  fun upsert(context: Context, rule: ForcedRule) {
    val root = JSONObject(context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(RULES, "{}") ?: "{}")
    root.put(rule.id, rule.json()); context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(RULES, root.toString()).commit()
    schedule(context, rule)
  }
  fun cancel(context: Context, id: String) {
    cancelAlarms(context, id); val root = JSONObject(context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(RULES, "{}") ?: "{}")
    root.remove(id); context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(RULES, root.toString()).commit()
  }
  fun satisfyToday(context: Context, id: String) { get(context, id)?.let { if (it.recurring) upsert(context, it.copy(triggerAt = nextOccurrence(it.dailyMinute), delayCount = 0)) else cancel(context, id) } }
  fun delay(context: Context, id: String) {
    val rule = get(context, id) ?: return; if (rule.delayCount >= 2) return
    upsert(context, rule.copy(triggerAt = System.currentTimeMillis() + 20 * 60 * 1000, delayCount = rule.delayCount + 1))
  }
  fun scheduleAll(context: Context) { list(context).forEach { if (it.triggerAt > System.currentTimeMillis()) schedule(context, it) else upsert(context, it.copy(triggerAt = System.currentTimeMillis() + 10 * 60 * 1000)) } }
  fun nextOccurrence(dailyMinute: Int): Long {
    val calendar = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, dailyMinute / 60); set(Calendar.MINUTE, dailyMinute % 60); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
    if (calendar.timeInMillis <= System.currentTimeMillis()) calendar.add(Calendar.DAY_OF_YEAR, 1)
    return calendar.timeInMillis
  }
  private fun schedule(context: Context, rule: ForcedRule) {
    val alarms = context.getSystemService(AlarmManager::class.java)
    if (Build.VERSION.SDK_INT >= 31 && !alarms.canScheduleExactAlarms()) throw SecurityException("Exact alarm permission is required")
    cancelAlarms(context, rule.id)
    exact(alarms, rule.triggerAt - 10 * 60 * 1000, pending(context, rule.id, ForcedTriggerReceiver.STAGE_BUFFER, 1))
    exact(alarms, rule.triggerAt, pending(context, rule.id, ForcedTriggerReceiver.STAGE_FINAL, 2))
  }
  private fun exact(manager: AlarmManager, at: Long, operation: PendingIntent) {
    manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.coerceAtLeast(System.currentTimeMillis() + 1000), operation)
  }
  private fun cancelAlarms(context: Context, id: String) { val manager = context.getSystemService(AlarmManager::class.java); manager.cancel(pending(context, id, ForcedTriggerReceiver.STAGE_BUFFER, 1)); manager.cancel(pending(context, id, ForcedTriggerReceiver.STAGE_FINAL, 2)) }
  private fun pending(context: Context, id: String, stage: String, offset: Int) = PendingIntent.getBroadcast(context, id.hashCode() + offset,
    Intent(context, ForcedTriggerReceiver::class.java).setAction(ForcedTriggerReceiver.ACTION_ALARM).putExtra(ForcedTriggerReceiver.EXTRA_RULE_ID, id).putExtra(ForcedTriggerReceiver.EXTRA_STAGE, stage), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  private fun parse(json: JSONObject) = ForcedRule(json.getString("id"), json.getString("sourceId"), json.getString("title"), json.getInt("durationMinutes"), json.getInt("dailyMinute"), json.getLong("triggerAt"), json.getInt("delayCount"), json.optBoolean("recurring", true))
}
