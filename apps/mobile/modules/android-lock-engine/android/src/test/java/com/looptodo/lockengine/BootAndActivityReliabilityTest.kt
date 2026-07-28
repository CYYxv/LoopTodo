package com.looptodo.lockengine

import android.content.Context
import android.content.Intent
import android.view.WindowManager
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class BootAndActivityReliabilityTest {
  private lateinit var context: Context

  @Before
  fun setUp() {
    context = RuntimeEnvironment.getApplication()
    FocusRestrictionState.clear(context)
    WhitelistBlockerState.clear(context)
  }

  @After
  fun tearDown() {
    FocusRestrictionState.clear(context)
    WhitelistBlockerState.clear(context)
  }

  @Test
  fun `boot clears blocker elapsed realtime deadline`() {
    WhitelistBlockerState.begin(context, "focus-before-reboot")

    BootReceiver().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))

    assertNull(WhitelistBlockerState.deadline(context, "focus-before-reboot"))
  }

  @Test
  fun `blocked activity is not shown over lockscreen`() {
    val restrictions = FocusRestrictions(
      sessionId = "focus-activity",
      mode = FocusRestrictionMode.WHITELIST,
      blockLeaving = true,
      expiresAt = System.currentTimeMillis() + 60_000L,
    )
    FocusRestrictionState.write(context, restrictions)
    val intent = Intent(context, WhitelistBlockedActivity::class.java)
      .putExtra(WhitelistBlockedActivity.EXTRA_SESSION_ID, restrictions.sessionId)

    val activity = Robolectric.buildActivity(WhitelistBlockedActivity::class.java, intent).create().get()
    val flags = activity.window.attributes.flags

    assertEquals(0, flags and WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
    assertTrue(flags and WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON != 0)
  }
}
