package com.looptodo.lockengine

import android.app.AppOpsManager
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.os.SystemClock
import android.provider.Settings
import android.telecom.TelecomManager
import android.util.Log
import kotlinx.coroutines.delay

fun interface FocusPermissionChecker {
  fun invalidReason(): String?
}

data class ForegroundSafety(
  val keyguardLocked: Boolean = false,
) {
  val protected: Boolean get() = keyguardLocked
}

class AndroidFocusPermissionChecker(private val context: Context) : FocusPermissionChecker {
  override fun invalidReason(): String? = when {
    !usageAccessEnabled(context) -> "需要允许查看应用使用情况"
    !overlayEnabled(context) -> "需要允许显示在其他应用上层"
    !backgroundLaunchCapability(context).effective -> "需要在系统设置允许后台弹出界面"
    else -> null
  }
}

class FocusRestrictionRuntime(
  private val context: Context,
  private val permissionChecker: FocusPermissionChecker,
  private val startBlockerActivity: (Intent) -> Unit = context::startActivity,
  private val onInvalidated: () -> Unit,
) {
  fun acknowledgeReady(restrictions: FocusRestrictions): Boolean {
    if (!validatePermissions(restrictions)) return false
    return launchReadinessProbe(restrictions)
  }

  private fun launchReadinessProbe(restrictions: FocusRestrictions): Boolean {
    val intent = Intent(context, FocusRestrictionProbeActivity::class.java)
      .putExtra(EXTRA_SESSION_ID, restrictions.sessionId)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
    return try {
      startBlockerActivity(intent)
      true
    } catch (error: RuntimeException) {
      Log.e(TAG, "Unable to launch focus restriction readiness probe", error)
      invalidate(restrictions, "无法验证软件拦截页面可拉起")
      false
    }
  }

  fun validatePermissions(restrictions: FocusRestrictions): Boolean {
    val reason = permissionChecker.invalidReason() ?: return true
    invalidate(restrictions, reason)
    return false
  }

  fun invalidate(restrictions: FocusRestrictions, reason: String) {
    FocusRestrictionState.invalidate(context, restrictions.sessionId, reason)
    WhitelistBlockerState.clear(context)
    context.sendBroadcast(
      Intent(ACTION_FOCUS_RESTRICTION_INVALIDATED)
        .setPackage(context.packageName)
        .putExtra(EXTRA_SESSION_ID, restrictions.sessionId)
        .putExtra(EXTRA_REASON, reason),
    )
    context.sendBroadcast(Intent(WhitelistBlockedActivity.ACTION_FINISH).setPackage(context.packageName))
    onInvalidated()
  }

  fun launchBlocker(sessionId: String): Boolean {
    WhitelistBlockerState.begin(context, sessionId)
    val intent = Intent(context, WhitelistBlockedActivity::class.java)
      .putExtra(WhitelistBlockedActivity.EXTRA_SESSION_ID, sessionId)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return try {
      startBlockerActivity(intent)
      true
    } catch (error: RuntimeException) {
      WhitelistBlockerState.clear(context)
      Log.e(TAG, "Unable to launch whitelist blocker; the monitor will retry", error)
      context.sendBroadcast(
        Intent(ACTION_BLOCKER_LAUNCH_FAILED)
          .setPackage(context.packageName)
          .putExtra(EXTRA_SESSION_ID, sessionId)
          .putExtra(EXTRA_REASON, error.message),
      )
      false
    }
  }

  companion object {
    const val ACTION_FOCUS_RESTRICTION_INVALIDATED = "com.looptodo.lockengine.FOCUS_RESTRICTION_INVALIDATED"
    const val ACTION_BLOCKER_LAUNCH_FAILED = "com.looptodo.lockengine.BLOCKER_LAUNCH_FAILED"
    const val EXTRA_SESSION_ID = "session_id"
    const val EXTRA_REASON = "reason"
    private const val TAG = "LoopTodoLock"
  }
}

suspend fun startAndAwaitFocusRuntime(
  context: Context,
  sessionId: String,
  startService: () -> Unit,
  stopService: () -> Unit,
  timeoutMs: Long = 2_000L,
  clock: () -> Long = SystemClock::elapsedRealtime,
  pause: suspend (Long) -> Unit = { delay(it) },
): FocusRuntimeState {
  try {
    startService()
  } catch (error: RuntimeException) {
    FocusRestrictionState.invalidate(context, sessionId, error.message ?: "无法启动专注前台服务")
    return FocusRestrictionState.runtimeState(context)
  }

  val deadline = clock() + timeoutMs
  while (clock() < deadline) {
    val state = FocusRestrictionState.runtimeState(context)
    if (state.sessionId == sessionId && state.status == FocusRuntimeStatus.READY) return state
    if (state.sessionId == sessionId && state.status == FocusRuntimeStatus.INVALID) {
      stopService()
      return state
    }
    pause(25L)
  }

  FocusRestrictionState.invalidate(context, sessionId, "专注前台服务启动超时")
  stopService()
  return FocusRestrictionState.runtimeState(context)
}

fun shouldBlockForeground(
  restrictions: FocusRestrictions,
  packageName: String,
  ownPackage: String,
  protectedPackages: Set<String>,
  safety: ForegroundSafety,
): Boolean = !safety.protected && !restrictions.allows(packageName, ownPackage, protectedPackages)

object SystemForegroundSafety {
  fun snapshot(context: Context): ForegroundSafety {
    val keyguardLocked = context.getSystemService(KeyguardManager::class.java)?.isKeyguardLocked == true
    return ForegroundSafety(keyguardLocked)
  }
}

fun protectedForegroundPackages(context: Context): Set<String> = buildSet {
  addAll(
    setOf(
      "android",
      "com.android.systemui",
      "com.android.keyguard",
      "com.android.permissioncontroller",
      "com.google.android.permissioncontroller",
      "com.android.packageinstaller",
      "com.google.android.packageinstaller",
      "com.android.server.telecom",
      "com.android.phone",
      "com.android.incallui",
      "com.google.android.dialer",
      "com.android.emergency",
      "com.samsung.android.incallui",
    ),
  )
  context.getSystemService(TelecomManager::class.java)?.defaultDialerPackage?.takeIf { it.isNotBlank() }?.let(::add)
  context.packageManager.resolveActivity(Intent(Intent.ACTION_DIAL), 0)?.activityInfo?.packageName?.let(::add)
}

fun usageAccessEnabled(context: Context): Boolean {
  val manager = context.getSystemService(AppOpsManager::class.java) ?: return false
  val mode = if (Build.VERSION.SDK_INT >= 29) {
    manager.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
  } else {
    @Suppress("DEPRECATION")
    manager.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
  }
  return mode == AppOpsManager.MODE_ALLOWED
}

fun overlayEnabled(context: Context): Boolean = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(context)
