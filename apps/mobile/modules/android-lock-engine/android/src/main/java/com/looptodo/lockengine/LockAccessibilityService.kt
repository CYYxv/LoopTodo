package com.looptodo.lockengine

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent

class LockAccessibilityService : AccessibilityService() {
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val session = LockState.read(this); val restrictions = FocusRestrictionState.read(this)
    if ((session?.enhanced != true && !restrictions.blockLeaving) || event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val packageName = event.packageName?.toString() ?: return
    if (packageName != applicationContext.packageName && !packageName.startsWith("com.android.dialer") && !packageName.startsWith("com.android.camera")) {
      val intent = if (session != null) Intent(this, LockActivity::class.java) else packageManager.getLaunchIntentForPackage(applicationContext.packageName)
      intent?.let { startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)) }
    }
  }
  override fun onInterrupt() = Unit
}
