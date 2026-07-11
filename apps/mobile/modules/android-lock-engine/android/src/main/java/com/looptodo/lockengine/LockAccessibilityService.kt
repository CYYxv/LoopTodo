package com.looptodo.lockengine

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent

class LockAccessibilityService : AccessibilityService() {
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val session = LockState.read(this) ?: return
    if (!session.enhanced || event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val packageName = event.packageName?.toString() ?: return
    if (packageName != applicationContext.packageName && !packageName.startsWith("com.android.dialer") && !packageName.startsWith("com.android.camera")) {
      startActivity(Intent(this, LockActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT))
    }
  }
  override fun onInterrupt() = Unit
}
