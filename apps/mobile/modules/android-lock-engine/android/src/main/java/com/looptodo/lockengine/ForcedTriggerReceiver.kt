package com.looptodo.lockengine

import android.app.*
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import java.util.UUID

class ForcedTriggerReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(EXTRA_RULE_ID) ?: return; val rule = ForcedRuleState.get(context, id) ?: return
    when (intent.action) {
      ACTION_START -> startLock(context, rule)
      ACTION_DELAY -> { ForcedRuleState.delay(context, id); postReminder(context, ForcedRuleState.get(context, id) ?: rule) }
      ACTION_ALARM -> if (intent.getStringExtra(EXTRA_STAGE) == STAGE_BUFFER) postReminder(context, rule) else startLock(context, rule)
    }
  }
  private fun startLock(context: Context, rule: ForcedRule) {
    if (!LockState.riskConfirmed(context) || !notificationListenerEnabled(context) || LockState.read(context) != null) { postPermissionWarning(context, rule); return }
    val now = System.currentTimeMillis(); val session = LockSession(UUID.randomUUID().toString(), rule.sourceId, rule.title, now, now + rule.durationMinutes.coerceIn(1, 180) * 60_000L, accessibilityEnabled(context))
    LockState.write(context, session); ContextCompat.startForegroundService(context, Intent(context, LockForegroundService::class.java)); ForcedRuleState.satisfyToday(context, rule.id)
  }
  private fun postReminder(context: Context, rule: ForcedRule) {
    createChannel(context); val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent(context, LockActivity::class.java)
    val open = PendingIntent.getActivity(context, rule.id.hashCode(), launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val start = action(context, rule.id, ACTION_START, 10); val delay = action(context, rule.id, ACTION_DELAY, 20)
    val builder = builder(context).setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle("${rule.title} 即将强制锁机").setContentText("10 分钟缓冲期，可立即开始或延迟 20 分钟").setContentIntent(open).setAutoCancel(true).addAction(android.R.drawable.ic_media_play, "立即开始", start)
    if (rule.delayCount < 2) builder.addAction(android.R.drawable.ic_menu_recent_history, "延迟 20 分钟", delay)
    context.getSystemService(NotificationManager::class.java).notify(rule.id.hashCode(), builder.build())
  }
  private fun postPermissionWarning(context: Context, rule: ForcedRule) { createChannel(context); context.getSystemService(NotificationManager::class.java).notify(rule.id.hashCode(), builder(context).setSmallIcon(android.R.drawable.stat_sys_warning).setContentTitle("强制锁机未执行").setContentText("${rule.title}：权限缺失或已有锁机会话，请打开 LoopTodo 检查").build()) }
  private fun builder(context: Context) = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
  private fun createChannel(context: Context) { if (Build.VERSION.SDK_INT >= 26) context.getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(CHANNEL, "强制锁机提醒", NotificationManager.IMPORTANCE_HIGH)) }
  private fun action(context: Context, id: String, action: String, offset: Int) = PendingIntent.getBroadcast(context, id.hashCode() + offset, Intent(context, ForcedTriggerReceiver::class.java).setAction(action).putExtra(EXTRA_RULE_ID, id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  private fun accessibilityEnabled(context: Context): Boolean { val expected = ComponentName(context, LockAccessibilityService::class.java).flattenToString(); return Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)?.split(':')?.any { it.equals(expected, true) } == true }
  private fun notificationListenerEnabled(context: Context): Boolean { val expected = ComponentName(context, LockNotificationListener::class.java).flattenToString(); return Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")?.split(':')?.any { it.equals(expected, true) } == true }
  companion object { const val ACTION_ALARM = "com.looptodo.lockengine.FORCED_ALARM"; const val ACTION_START = "com.looptodo.lockengine.FORCED_START"; const val ACTION_DELAY = "com.looptodo.lockengine.FORCED_DELAY"; const val EXTRA_RULE_ID = "rule_id"; const val EXTRA_STAGE = "stage"; const val STAGE_BUFFER = "buffer"; const val STAGE_FINAL = "final"; const val CHANNEL = "forced-lock" }
}
