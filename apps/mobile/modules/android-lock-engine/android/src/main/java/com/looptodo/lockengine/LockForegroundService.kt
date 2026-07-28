package com.looptodo.lockengine

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock

class LockForegroundService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var restrictionRuntime: FocusRestrictionRuntime
  private var usageCursor = 0L
  private var foregroundPackage: String? = null
  private var lastBlockedPackage = ""
  private var lastBlockedAt = 0L
  private var blockerLaunchFailures = 0
  private val protectedPackages by lazy { protectedForegroundPackages(this) }
  private val monitor = object : Runnable {
    override fun run() {
      val lockSession = LockState.read(this@LockForegroundService)
      if (lockSession != null) {
        FocusRestrictionState.clear(this@LockForegroundService)
        scheduleAt(lockSession.endsAt)
        return
      }
      val restrictions = FocusRestrictionState.readActive(this@LockForegroundService)
      if (restrictions == null) return stopRuntime()
      if (!restrictionRuntime.validatePermissions(restrictions)) return
      val runtime = FocusRestrictionState.runtimeState(this@LockForegroundService)
      if (runtime.status != FocusRuntimeStatus.READY) {
        handler.postDelayed(this, POLL_INTERVAL_MS)
        return
      }
      FocusRestrictionState.markHeartbeat(this@LockForegroundService, restrictions.sessionId)
      inspectUsageEvents(restrictions)
      if (FocusRestrictionState.runtimeState(this@LockForegroundService).status == FocusRuntimeStatus.INVALID) return
      handler.postDelayed(this, POLL_INTERVAL_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    createChannel()
    restrictionRuntime = FocusRestrictionRuntime(
      context = this,
      permissionChecker = AndroidFocusPermissionChecker(this),
      onInvalidated = ::stopInvalidRuntime,
    )
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val lockSession = LockState.read(this)
    val restrictions = if (lockSession == null) FocusRestrictionState.readActive(this) else null
    if (lockSession == null && restrictions == null) {
      stopRuntime()
      return START_NOT_STICKY
    }
    if (lockSession != null) FocusRestrictionState.clear(this)
    try {
      startForeground(NOTIFICATION_ID, notification(lockSession?.taskTitle ?: "软件限制生效中"))
    } catch (error: RuntimeException) {
      if (restrictions != null) invalidateStart(restrictions, error)
      else stopRuntime()
      return START_NOT_STICKY
    }
    handler.removeCallbacksAndMessages(null)
    val now = System.currentTimeMillis()
    usageCursor = now - FOREGROUND_FALLBACK_WINDOW_MS
    foregroundPackage = getSystemService(UsageStatsManager::class.java)?.let { queryForegroundPackage(it, now) }
    blockerLaunchFailures = 0
    if (restrictions != null) {
      FocusRestrictionState.markStarting(this, restrictions.sessionId)
      if (!restrictionRuntime.acknowledgeReady(restrictions)) {
        stopInvalidRuntime()
        return START_NOT_STICKY
      }
      scheduleReadinessTimeout(restrictions.sessionId)
    }
    if (lockSession != null) scheduleAt(lockSession.endsAt) else handler.post(monitor)
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    val restrictions = FocusRestrictionState.read(this)
    val runtime = FocusRestrictionState.runtimeState(this)
    if (restrictions.sessionId.isNotBlank() && runtime.status == FocusRuntimeStatus.READY) {
      val reason = "专注前台服务已停止"
      FocusRestrictionState.invalidate(this, restrictions.sessionId, reason)
      sendBroadcast(
        Intent(FocusRestrictionRuntime.ACTION_FOCUS_RESTRICTION_INVALIDATED)
          .setPackage(packageName)
          .putExtra(FocusRestrictionRuntime.EXTRA_SESSION_ID, restrictions.sessionId)
          .putExtra(FocusRestrictionRuntime.EXTRA_REASON, reason),
      )
    }
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun inspectUsageEvents(restrictions: FocusRestrictions) {
    val now = System.currentTimeMillis()
    val manager = getSystemService(UsageStatsManager::class.java) ?: return
    val events = manager.queryEvents(usageCursor.coerceAtMost(now), now)
    val event = UsageEvents.Event()
    var latestPackage: String? = null
    var latestTimestamp = usageCursor
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (isForegroundEvent(event.eventType) && event.timeStamp >= latestTimestamp) {
        latestPackage = event.packageName
        latestTimestamp = event.timeStamp
      }
    }
    usageCursor = maxOf(usageCursor + 1L, latestTimestamp + 1L, now - 250L)
    if (latestPackage != null) foregroundPackage = latestPackage
    if (foregroundPackage == null) foregroundPackage = queryForegroundPackage(manager, now)
    val packageName = foregroundPackage ?: return
    val safety = SystemForegroundSafety.snapshot(this)
    if (shouldRefocusBlocker(
        WhitelistBlockerState.deadline(this, restrictions.sessionId),
        SystemClock.elapsedRealtime(),
        packageName,
        applicationContext.packageName,
        safety,
      )) {
      if (now - lastBlockedAt >= BLOCK_DEBOUNCE_MS) launchBlocker(restrictions, packageName, now)
      return
    }
    if (!shouldBlockForeground(
        restrictions,
        packageName,
        applicationContext.packageName,
        protectedPackages,
        safety,
      )) {
      blockerLaunchFailures = 0
      return
    }
    if (packageName == lastBlockedPackage && now - lastBlockedAt < BLOCK_DEBOUNCE_MS) return
    RestrictionAnalyticsStore.recordBlocked(this, restrictions.sessionId, packageName, now)
    launchBlocker(restrictions, packageName, now)
  }

  private fun queryForegroundPackage(manager: UsageStatsManager, now: Long): String? {
    val stats = runCatching {
      manager.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        now - FOREGROUND_FALLBACK_WINDOW_MS,
        now,
      )
    }.getOrNull().orEmpty()
    return selectForegroundPackage(stats.map(::foregroundUsageSnapshot))
  }

  private fun launchBlocker(restrictions: FocusRestrictions, packageName: String, now: Long) {
    if (restrictionRuntime.launchBlocker(restrictions.sessionId)) {
      blockerLaunchFailures = 0
      lastBlockedPackage = packageName
      lastBlockedAt = now
    } else {
      blockerLaunchFailures += 1
      if (blockerLaunchFailures >= BLOCKER_FAILURE_LIMIT) {
        restrictionRuntime.invalidate(restrictions, "无法显示软件拦截页面")
      }
    }
  }

  private fun scheduleReadinessTimeout(sessionId: String) {
    handler.postDelayed({
      val restrictions = FocusRestrictionState.readActive(this)
      val runtime = FocusRestrictionState.runtimeState(this)
      if (restrictions?.sessionId == sessionId && runtime.sessionId == sessionId && runtime.status != FocusRuntimeStatus.READY) {
        restrictionRuntime.invalidate(restrictions, "软件拦截页面启动验证超时")
      }
    }, READINESS_PROBE_TIMEOUT_MS)
  }

  private fun isForegroundEvent(type: Int): Boolean =
    type == UsageEvents.Event.MOVE_TO_FOREGROUND ||
      (Build.VERSION.SDK_INT >= 29 && type == UsageEvents.Event.ACTIVITY_RESUMED)

  private fun scheduleAt(endsAt: Long) {
    handler.postDelayed({
      if (LockState.read(this) == null) stopRuntime()
    }, (endsAt - System.currentTimeMillis()).coerceAtLeast(1_000L))
  }

  private fun stopRuntime() {
    handler.removeCallbacksAndMessages(null)
    val runtime = FocusRestrictionState.runtimeState(this)
    if (runtime.status != FocusRuntimeStatus.INVALID) FocusRestrictionState.clear(this)
    WhitelistBlockerState.clear(this)
    sendBroadcast(Intent(WhitelistBlockedActivity.ACTION_FINISH).setPackage(packageName))
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun stopInvalidRuntime() {
    handler.removeCallbacksAndMessages(null)
    WhitelistBlockerState.clear(this)
    sendBroadcast(Intent(WhitelistBlockedActivity.ACTION_FINISH).setPackage(packageName))
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun invalidateStart(restrictions: FocusRestrictions, error: RuntimeException) {
    val reason = error.message ?: "无法启动专注前台服务"
    FocusRestrictionState.invalidate(this, restrictions.sessionId, reason)
    sendBroadcast(
      Intent(FocusRestrictionRuntime.ACTION_FOCUS_RESTRICTION_INVALIDATED)
        .setPackage(packageName)
        .putExtra(FocusRestrictionRuntime.EXTRA_SESSION_ID, restrictions.sessionId)
        .putExtra(FocusRestrictionRuntime.EXTRA_REASON, reason),
    )
    stopInvalidRuntime()
  }

  private fun notification(title: String): Notification {
    val pending = PendingIntent.getActivity(
      this,
      1,
      packageManager.getLaunchIntentForPackage(packageName),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    return builder.setSmallIcon(android.R.drawable.ic_lock_lock)
      .setContentTitle("LoopTodo 专注进行中")
      .setContentText(title)
      .setOngoing(true)
      .setContentIntent(pending)
      .build()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= 26) {
      getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(CHANNEL, "专注状态", NotificationManager.IMPORTANCE_LOW),
      )
    }
  }

  companion object {
    const val CHANNEL = "lock-session"
    private const val NOTIFICATION_ID = 4101
    private const val POLL_INTERVAL_MS = 250L
    private const val BLOCK_DEBOUNCE_MS = 300L
    private const val BLOCKER_FAILURE_LIMIT = 3
    private const val FOREGROUND_FALLBACK_WINDOW_MS = 10_000L
    private const val READINESS_PROBE_TIMEOUT_MS = 1_500L
  }
}

data class ForegroundUsageSnapshot(
  val packageName: String,
  val lastActiveAt: Long,
)

fun selectForegroundPackage(stats: List<ForegroundUsageSnapshot>): String? = stats
  .asSequence()
  .filter { it.packageName.isNotBlank() }
  .maxByOrNull { it.lastActiveAt }
  ?.packageName

fun shouldRefocusBlocker(
  blockerDeadlineElapsed: Long?,
  nowElapsed: Long,
  foregroundPackage: String,
  ownPackage: String,
  safety: ForegroundSafety,
): Boolean = blockerDeadlineElapsed != null &&
  blockerDeadlineElapsed > nowElapsed &&
  foregroundPackage.isNotBlank() &&
  foregroundPackage != ownPackage &&
  !safety.protected

private fun foregroundUsageSnapshot(stats: UsageStats): ForegroundUsageSnapshot {
  val lastVisibleAt = if (Build.VERSION.SDK_INT >= 29) stats.lastTimeVisible else 0L
  return ForegroundUsageSnapshot(stats.packageName.orEmpty(), maxOf(stats.lastTimeUsed, lastVisibleAt))
}
