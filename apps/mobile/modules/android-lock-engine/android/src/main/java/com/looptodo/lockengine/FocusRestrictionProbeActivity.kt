package com.looptodo.lockengine

import android.app.Activity
import android.os.Bundle

class FocusRestrictionProbeActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val sessionId = intent?.getStringExtra(FocusRestrictionRuntime.EXTRA_SESSION_ID).orEmpty()
    val restrictions = FocusRestrictionState.readActive(this)
    if (sessionId.isNotBlank() && restrictions?.sessionId == sessionId) {
      FocusRestrictionState.markReady(this, sessionId)
    }
    finish()
    overridePendingTransition(0, 0)
  }
}
