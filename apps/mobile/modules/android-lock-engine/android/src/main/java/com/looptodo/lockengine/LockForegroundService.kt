package com.looptodo.lockengine

import android.app.*
import android.content.Intent
import android.os.IBinder
import android.os.Handler
import android.os.Looper

class LockForegroundService : Service() {
  override fun onCreate() { super.onCreate(); createChannel() }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val session = LockState.read(this) ?: run { stopSelf(); return START_NOT_STICKY }
    val pending = PendingIntent.getActivity(this, 1, Intent(this, LockActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val builder = if (android.os.Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    val notification = builder.setSmallIcon(android.R.drawable.ic_lock_lock).setContentTitle("LoopTodo 锁机进行中")
      .setContentText(session.taskTitle).setOngoing(true).setContentIntent(pending).build()
    startForeground(4101, notification)
    Handler(Looper.getMainLooper()).postDelayed({
      if (LockState.read(this) == null) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf() }
    }, (session.endsAt - System.currentTimeMillis()).coerceAtLeast(1000))
    return START_STICKY
  }
  override fun onBind(intent: Intent?): IBinder? = null
  private fun createChannel() { if (android.os.Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(CHANNEL, "锁机状态", NotificationManager.IMPORTANCE_HIGH)) }
  companion object { const val CHANNEL = "lock-session" }
}
