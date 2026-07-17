package com.looptodo.usagestats

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LoopTodoUsageStatsModule : Module() {
  private val maxRangeMs = 31L * 24 * 60 * 60 * 1000
  private val stateLookbackMs = maxRangeMs

  override fun definition() = ModuleDefinition {
    Name("LoopTodoUsageStats")

    AsyncFunction("getUsageAccessStatus") {
      if (hasUsageAccess(context())) "granted" else "denied"
    }

    AsyncFunction("openUsageAccessSettings") {
      val context = context()
      val appSettings = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:${context.packageName}"))
      val generalSettings = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      val fallbackSettings = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      val intent = listOf(appSettings, generalSettings, fallbackSettings)
        .firstOrNull { it.resolveActivity(context.packageManager) != null }
        ?: error("Usage access settings are unavailable")
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    AsyncFunction("queryAppUsage") { startAt: Double, endAt: Double ->
      require(startAt.isFinite() && startAt >= 0) { "startAt must be a non-negative timestamp" }
      require(endAt.isFinite() && endAt > startAt) { "endAt must be greater than startAt" }
      require(endAt - startAt <= maxRangeMs) { "App usage range cannot exceed 31 days" }
      val context = context()
      if (!hasUsageAccess(context)) emptyUsageResult() else queryUsage(context, startAt.toLong(), endAt.toLong())
    }
  }

  private fun context(): Context = appContext.reactContext ?: error("Android context unavailable")

  private fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun queryUsage(context: Context, startAt: Long, endAt: Long): Map<String, Any> {
    val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val activeSince = mutableMapOf<String, Long>()
    val durations = mutableMapOf<String, Long>()
    val observedPackages = mutableSetOf<String>()
    val events = mutableListOf<Map<String, Any>>()
    val usageEvents = manager.queryEvents(maxOf(0, startAt - stateLookbackMs), endAt)
    val event = UsageEvents.Event()
    while (usageEvents.hasNextEvent()) {
      usageEvents.getNextEvent(event)
      val packageName = event.packageName?.takeIf { it.isNotBlank() } ?: continue
      val eventType = when (event.eventType) {
        UsageEvents.Event.MOVE_TO_FOREGROUND -> "foreground"
        UsageEvents.Event.MOVE_TO_BACKGROUND -> "background"
        else -> null
      }
      if (eventType == "foreground") {
        activeSince.putIfAbsent(packageName, maxOf(startAt, event.timeStamp))
      } else if (eventType == "background") {
        val foregroundAt = activeSince.remove(packageName)
        val effectiveStart = foregroundAt ?: if (event.timeStamp >= startAt && packageName !in observedPackages) startAt else null
        if (effectiveStart != null) durations[packageName] = (durations[packageName] ?: 0) +
          maxOf(0, minOf(endAt, event.timeStamp) - maxOf(startAt, effectiveStart))
      }
      if (eventType != null && event.timeStamp >= startAt && event.timeStamp < endAt) {
        events += mapOf(
          "packageName" to packageName,
          "timestamp" to event.timeStamp.toDouble(),
          "eventType" to eventType
        )
      }
      if (eventType != null) observedPackages += packageName
    }
    for ((packageName, foregroundAt) in activeSince) {
      durations[packageName] = (durations[packageName] ?: 0) + maxOf(0, endAt - maxOf(startAt, foregroundAt))
    }

    val apps = durations.filterValues { it > 0 }.map { (packageName, duration) ->
      mapOf(
        "packageName" to packageName,
        "label" to applicationLabel(context, packageName),
        "foregroundDurationMs" to duration.toDouble()
      )
    }.sortedByDescending { it["foregroundDurationMs"] as Double }

    return mapOf("apps" to apps, "events" to events)
  }

  private fun applicationLabel(context: Context, packageName: String): String = try {
    val info = context.packageManager.getApplicationInfo(packageName, 0)
    context.packageManager.getApplicationLabel(info).toString().ifBlank { packageName }
  } catch (_: Exception) {
    packageName
  }

  private fun emptyUsageResult(): Map<String, Any> = mapOf("apps" to emptyList<Any>(), "events" to emptyList<Any>())
}
