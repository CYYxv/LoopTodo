package com.looptodo.lockengine

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.ceil

class WhitelistBlockedActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var countdown: TextView
  private lateinit var remainingFocus: TextView
  private var sessionId = ""
  private var deadlineElapsed = 0L
  private var returning = false
  private val finishReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) = finishBlocker()
  }
  private val tick = object : Runnable {
    override fun run() {
      val restrictions = FocusRestrictionState.readActive(this@WhitelistBlockedActivity)
      if (restrictions?.sessionId != sessionId) return finishBlocker()
      val remaining = deadlineElapsed - SystemClock.elapsedRealtime()
      if (remaining <= 0L) return returnToLoopTodo()
      countdown.text = "${ceil(remaining / 1000.0).toInt()} 秒后返回 LoopTodo"
      remainingFocus.text = formatRemainingFocusTime(restrictions.expiresAt - System.currentTimeMillis())
      handler.postDelayed(this, 100L)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    registerFinishReceiver()
    consumeIntent(intent)
    RestrictionAnalyticsStore.recordBlockerShown(this, sessionId)
    render()
    enterImmersiveMode()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    consumeIntent(intent)
    RestrictionAnalyticsStore.recordBlockerShown(this, sessionId)
    enterImmersiveMode()
  }

  override fun onResume() {
    super.onResume()
    if (SystemForegroundSafety.snapshot(this).protected) return finishBlocker()
    val restrictions = FocusRestrictionState.readActive(this)
    if (restrictions?.sessionId != sessionId) return finishBlocker()
    deadlineElapsed = WhitelistBlockerState.deadline(this, sessionId)
      ?: WhitelistBlockerState.begin(this, sessionId)
    handler.removeCallbacks(tick)
    handler.post(tick)
    enterImmersiveMode()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) enterImmersiveMode()
    else if (!returning && SystemClock.elapsedRealtime() < deadlineElapsed) {
      if (SystemForegroundSafety.snapshot(this).protected) finishBlocker()
      else handler.postDelayed({ bringToFront() }, 120L)
    }
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    runCatching { unregisterReceiver(finishReceiver) }
    super.onDestroy()
  }

  @Deprecated("Blocked activity owns back navigation")
  override fun onBackPressed() = returnToLoopTodo()

  private fun consumeIntent(intent: Intent?) {
    val requestedSession = intent?.getStringExtra(EXTRA_SESSION_ID).orEmpty()
    val restrictions = FocusRestrictionState.readActive(this)
    if (requestedSession.isBlank() || restrictions?.sessionId != requestedSession) return finishBlocker()
    sessionId = requestedSession
    deadlineElapsed = WhitelistBlockerState.begin(this, sessionId)
  }

  private fun render() {
    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(56, 56, 56, 56)
      setBackgroundColor(Color.rgb(241, 247, 255))
    }
    layout.addView(TextView(this).apply {
      text = "这个软件不在本次白名单中"
      textSize = 26f
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(16, 45, 82))
    })
    val restrictions = FocusRestrictionState.readActive(this)
    layout.addView(TextView(this).apply {
      text = restrictions?.taskTitle?.takeIf { it.isNotBlank() } ?: "当前专注"
      textSize = 20f
      gravity = Gravity.CENTER
      setPadding(0, 28, 0, 8)
      setTextColor(Color.rgb(16, 45, 82))
    })
    remainingFocus = TextView(this).apply {
      text = formatRemainingFocusTime((restrictions?.expiresAt ?: 0L) - System.currentTimeMillis())
      textSize = 16f
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(58, 75, 96))
    }
    layout.addView(remainingFocus)
    countdown = TextView(this).apply {
      textSize = 18f
      gravity = Gravity.CENTER
      setPadding(0, 28, 0, 28)
      setTextColor(Color.rgb(58, 75, 96))
    }
    layout.addView(countdown)
    layout.addView(Button(this).apply {
      text = "立即返回"
      setOnClickListener { returnToLoopTodo() }
    })
    setContentView(layout)
  }

  private fun returnToLoopTodo() {
    if (returning) return
    returning = true
    WhitelistBlockerState.clear(this)
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      startActivity(it.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    finishAndRemoveTask()
  }

  private fun bringToFront() {
    if (returning || SystemForegroundSafety.snapshot(this).protected || FocusRestrictionState.readActive(this)?.sessionId != sessionId) return
    try {
      RestrictionAnalyticsStore.recordBlockerRefocused(this, sessionId, "overview")
      startActivity(Intent(this, WhitelistBlockedActivity::class.java)
        .putExtra(EXTRA_SESSION_ID, sessionId)
        .addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP))
    } catch (error: RuntimeException) {
      Log.e(TAG, "Unable to restore whitelist blocker activity", error)
      finishBlocker()
    }
  }

  private fun finishBlocker() {
    returning = true
    WhitelistBlockerState.clear(this)
    finishAndRemoveTask()
  }

  private fun enterImmersiveMode() {
    if (android.os.Build.VERSION.SDK_INT >= 30) {
      window.insetsController?.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
    } else {
      @Suppress("DEPRECATION")
      window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
    }
  }

  private fun registerFinishReceiver() {
    val filter = IntentFilter(ACTION_FINISH)
    if (android.os.Build.VERSION.SDK_INT >= 33) registerReceiver(finishReceiver, filter, RECEIVER_NOT_EXPORTED)
    else @Suppress("DEPRECATION") registerReceiver(finishReceiver, filter)
  }

  companion object {
    const val EXTRA_SESSION_ID = "session_id"
    const val ACTION_FINISH = "com.looptodo.lockengine.FINISH_WHITELIST_BLOCKER"
    private const val TAG = "LoopTodoLock"
  }
}

fun formatRemainingFocusTime(remainingMs: Long): String {
  if (remainingMs <= 60_000L) return "剩余不足 1 分钟"
  return "剩余 ${ceil(remainingMs / 60_000.0).toInt()} 分钟"
}
