package com.looptodo.lockengine

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object RestrictionAnalyticsStore {
  private const val FILE = "looptodo_restriction_analytics"
  private const val QUEUE = "events"
  private const val MAX_EVENTS = 100
  internal const val BLOCK_DEBOUNCE_MS = 10_000L

  @Synchronized
  fun recordBlocked(context: Context, sessionId: String, blockedApp: String, at: Long = System.currentTimeMillis()) {
    if (sessionId.isBlank() || blockedApp.isBlank()) return
    val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    val lastApp = preferences.getString("last_blocked_app", null)
    val lastAt = preferences.getLong("last_blocked_at", 0L)
    preferences.edit()
      .putString("blocker_session", sessionId)
      .putLong("blocker_requested_at", at)
      .apply()
    if (lastApp == blockedApp && at - lastAt < BLOCK_DEBOUNCE_MS) return
    preferences.edit().putString("last_blocked_app", blockedApp).putLong("last_blocked_at", at).apply()
    enqueue(context, "app_blocked", mapOf("sessionId" to sessionId), at)
  }

  @Synchronized
  fun recordBlockerShown(context: Context, sessionId: String, at: Long = System.currentTimeMillis()) {
    if (sessionId.isBlank()) return
    val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    if (preferences.getString("blocker_session", null) != sessionId) return
    val requestedAt = preferences.getLong("blocker_requested_at", 0L)
    if (requestedAt <= 0L) return
    preferences.edit().remove("blocker_requested_at").apply()
    enqueue(context, "whitelist_blocker_shown", mapOf(
      "detectionDelayMs" to (at - requestedAt).coerceAtLeast(0L),
      "autoReturn" to true,
    ), at)
  }

  @Synchronized
  fun recordBlockerRefocused(context: Context, sessionId: String, source: String, at: Long = System.currentTimeMillis()) {
    if (sessionId.isBlank() || source !in setOf("overview", "home", "otherApp")) return
    enqueue(context, "whitelist_blocker_refocused", mapOf("source" to source, "sessionId" to sessionId), at)
  }

  @Synchronized
  fun drain(context: Context): List<Map<String, Any?>> {
    val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    val queue = readQueue(preferences.getString(QUEUE, null))
    preferences.edit().remove(QUEUE).apply()
    return (0 until queue.length()).mapNotNull { index ->
      queue.optJSONObject(index)?.let(::eventToMap)
    }
  }

  @Synchronized
  fun clear(context: Context) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().clear().commit()
  }

  private fun enqueue(context: Context, event: String, props: Map<String, Any?>, at: Long) {
    val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    val queue = readQueue(preferences.getString(QUEUE, null))
    while (queue.length() >= MAX_EVENTS) queue.remove(0)
    queue.put(JSONObject().put("event", event).put("props", JSONObject(props)).put("at", at))
    preferences.edit().putString(QUEUE, queue.toString()).commit()
  }

  private fun readQueue(value: String?): JSONArray = runCatching { JSONArray(value ?: "[]") }.getOrDefault(JSONArray())

  private fun eventToMap(value: JSONObject): Map<String, Any?> {
    val props = value.optJSONObject("props") ?: JSONObject()
    return mapOf(
      "event" to value.optString("event"),
      "props" to props.keys().asSequence().associateWith { key -> props.opt(key).takeUnless { it == JSONObject.NULL } },
      "at" to value.optLong("at"),
    )
  }
}
