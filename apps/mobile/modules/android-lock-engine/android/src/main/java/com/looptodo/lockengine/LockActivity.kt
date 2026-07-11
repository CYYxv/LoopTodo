package com.looptodo.lockengine

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.IntentFilter
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.WindowManager
import android.widget.*

class LockActivity : Activity() {
  private val finishReceiver = object : BroadcastReceiver() { override fun onReceive(context: Context?, intent: Intent?) { finishLockActivity() } }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState); window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    if (android.os.Build.VERSION.SDK_INT >= 33) registerReceiver(finishReceiver, IntentFilter(ACTION_FINISH), RECEIVER_NOT_EXPORTED) else registerReceiver(finishReceiver, IntentFilter(ACTION_FINISH))
    if (getSystemService(DevicePolicyManager::class.java)?.isLockTaskPermitted(packageName) == true) startLockTask(); render()
  }
  override fun onDestroy() { unregisterReceiver(finishReceiver); super.onDestroy() }
  override fun onResume() { super.onResume(); if (LockState.read(this) == null) finish() else render() }
  @Deprecated("Lock sessions ignore the system back button") override fun onBackPressed() = Unit
  private fun render() {
    val session = LockState.read(this) ?: return finish()
    Handler(Looper.getMainLooper()).postDelayed({ if (LockState.read(this) == null) finish() }, (session.endsAt - System.currentTimeMillis()).coerceAtLeast(1000))
    val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(48, 48, 48, 48); setBackgroundColor(Color.rgb(246, 248, 250)) }
    layout.addView(TextView(this).apply { text = "LoopTodo 锁机模式"; textSize = 28f; gravity = Gravity.CENTER })
    layout.addView(TextView(this).apply { text = session.taskTitle; textSize = 20f; gravity = Gravity.CENTER; setPadding(0, 32, 0, 16) })
    val remaining = ((session.endsAt - System.currentTimeMillis()).coerceAtLeast(0) / 60000) + 1
    layout.addView(TextView(this).apply { text = "剩余约 ${remaining} 分钟"; textSize = 18f; gravity = Gravity.CENTER; setPadding(0, 0, 0, 24) })
    layout.addView(Button(this).apply { text = "紧急电话"; setOnClickListener { startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:110"))) } })
    layout.addView(Button(this).apply { text = "拍照"; setOnClickListener { startActivity(Intent(this@LockActivity, LockCameraActivity::class.java)) } })
    layout.addView(Button(this).apply { text = "紧急退出申请"; setOnClickListener { packageManager.getLaunchIntentForPackage(packageName)?.let { intent -> startActivity(intent) } } })
    setContentView(layout)
  }
  private fun finishLockActivity() { try { stopLockTask() } catch (_: Exception) {}; finish() }
  companion object { const val ACTION_FINISH = "com.looptodo.lockengine.FINISH" }
}
