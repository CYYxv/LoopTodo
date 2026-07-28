package com.looptodo.lockengine

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class FocusRestrictionReliabilityTest {
  private lateinit var context: Context
  private lateinit var restrictions: FocusRestrictions

  @Before
  fun setUp() {
    context = RuntimeEnvironment.getApplication()
    restrictions = FocusRestrictions(
      sessionId = "focus-1",
      taskTitle = "复习数学错题",
      mode = FocusRestrictionMode.WHITELIST,
      blockLeaving = true,
      allowedPackages = setOf("com.example.allowed"),
      expiresAt = System.currentTimeMillis() + 60_000L,
    )
    FocusRestrictionState.clear(context)
    WhitelistBlockerState.clear(context)
    RestrictionAnalyticsStore.clear(context)
  }

  @After
  fun tearDown() {
    FocusRestrictionState.clear(context)
    WhitelistBlockerState.clear(context)
    RestrictionAnalyticsStore.clear(context)
  }

  @Test
  fun `start waits for service ready acknowledgement before reporting effective`() = runBlocking {
    FocusRestrictionState.write(context, restrictions)
    var now = 0L
    var reads = 0

    val state = startAndAwaitFocusRuntime(
      context = context,
      sessionId = restrictions.sessionId,
      startService = {},
      stopService = {},
      clock = { now },
      pause = {
        reads += 1
        now += it
        FocusRestrictionState.markReady(context, restrictions.sessionId)
      },
    )

    assertTrue(reads > 0)
    assertEquals(FocusRuntimeStatus.READY, state.status)
  }

  @Test
  fun `service start failure clears restrictions and stores invalid state`() = runBlocking {
    FocusRestrictionState.write(context, restrictions)

    val state = startAndAwaitFocusRuntime(
      context = context,
      sessionId = restrictions.sessionId,
      startService = { throw IllegalStateException("background start denied") },
      stopService = {},
    )

    assertFalse(FocusRestrictionState.read(context).isActive(System.currentTimeMillis()))
    assertEquals(FocusRuntimeStatus.INVALID, state.status)
    assertTrue(state.reason.orEmpty().contains("background start denied"))
  }

  @Test
  fun `permission revocation invalidates runtime and stops service`() {
    FocusRestrictionState.write(context, restrictions)
    var permissionReason: String? = null
    var stopped = false
    val runtime = FocusRestrictionRuntime(
      context = context,
      permissionChecker = FocusPermissionChecker { permissionReason },
      startBlockerActivity = {},
      onInvalidated = { stopped = true },
    )

    assertTrue(runtime.acknowledgeReady(restrictions))
    permissionReason = "需要允许显示在其他应用上层"

    assertFalse(runtime.validatePermissions(restrictions))
    assertTrue(stopped)
    assertFalse(FocusRestrictionState.read(context).isActive(System.currentTimeMillis()))
    assertEquals(FocusRuntimeStatus.INVALID, FocusRestrictionState.runtimeState(context).status)
    assertEquals(permissionReason, FocusRestrictionState.runtimeState(context).reason)
  }

  @Test
  fun `readiness acknowledgement waits for the invisible activity probe`() {
    FocusRestrictionState.write(context, restrictions)
    var launchedIntent: Intent? = null
    val runtime = FocusRestrictionRuntime(
      context = context,
      permissionChecker = FocusPermissionChecker { null },
      startBlockerActivity = { launchedIntent = it },
      onInvalidated = {},
    )

    assertTrue(runtime.acknowledgeReady(restrictions))
    assertEquals(FocusRuntimeStatus.STARTING, FocusRestrictionState.runtimeState(context).status)
    assertEquals("FocusRestrictionProbeActivity", launchedIntent?.component?.shortClassName?.substringAfterLast('.'))
    assertNull(WhitelistBlockerState.deadline(context, restrictions.sessionId))
  }

  @Test
  fun `usage stats fallback selects the most recently active package`() {
    val selected = selectForegroundPackage(
      listOf(
        ForegroundUsageSnapshot("com.example.old", 1_000L),
        ForegroundUsageSnapshot("", 5_000L),
        ForegroundUsageSnapshot("com.example.current", 4_000L),
      ),
    )

    assertEquals("com.example.current", selected)
    assertNull(selectForegroundPackage(emptyList()))
  }

  @Test
  fun `active blocker deadline refocuses Home and Recent without overriding safety`() {
    val deadline = 4_000L

    assertTrue(shouldRefocusBlocker(deadline, 1_000L, "com.android.systemui", context.packageName, ForegroundSafety()))
    assertTrue(shouldRefocusBlocker(deadline, 1_000L, "com.example.launcher", context.packageName, ForegroundSafety()))
    assertFalse(shouldRefocusBlocker(deadline, 1_000L, context.packageName, context.packageName, ForegroundSafety()))
    assertFalse(shouldRefocusBlocker(deadline, 4_000L, "com.example.launcher", context.packageName, ForegroundSafety()))
    assertFalse(shouldRefocusBlocker(deadline, 1_000L, "com.example.launcher", context.packageName, ForegroundSafety(keyguardLocked = true)))
  }

  @Test
  fun `non Xiaomi background launch proceeds to runtime probe when overlay is granted`() {
    val capability = backgroundLaunchCapability(context, manufacturer = "samsung", overlayGranted = true)

    assertTrue(capability.supported)
    assertTrue(capability.effective)
    assertNull(capability.reason)
  }

  @Test
  fun `non Xiaomi background launch waits for overlay before runtime probe`() {
    val capability = backgroundLaunchCapability(context, manufacturer = "samsung", overlayGranted = false)

    assertTrue(capability.supported)
    assertFalse(capability.effective)
    assertTrue(capability.reason.orEmpty().contains("显示在其他应用上层"))
  }

  @Test
  fun `blocker launch failure clears countdown and can retry`() {
    FocusRestrictionState.write(context, restrictions)
    var attempts = 0
    val runtime = FocusRestrictionRuntime(
      context = context,
      permissionChecker = FocusPermissionChecker { null },
      startBlockerActivity = {
        attempts += 1
        if (attempts == 1) throw IllegalStateException("background launch denied")
      },
      onInvalidated = {},
    )

    assertFalse(runtime.launchBlocker(restrictions.sessionId))
    assertNull(WhitelistBlockerState.deadline(context, restrictions.sessionId))

    assertTrue(runtime.launchBlocker(restrictions.sessionId))
    assertEquals(2, attempts)
    assertNotNull(WhitelistBlockerState.deadline(context, restrictions.sessionId))
  }

  @Test
  fun `lockscreen calls emergency dialer and security UI are never blocked`() {
    val protectedPackages = setOf(
      "com.android.systemui",
      "com.android.phone",
      "com.android.permissioncontroller",
    )

    assertFalse(shouldBlockForeground(restrictions, "com.example.blocked", context.packageName, protectedPackages, ForegroundSafety(keyguardLocked = true)))
    assertFalse(shouldBlockForeground(restrictions, "com.android.phone", context.packageName, protectedPackages, ForegroundSafety()))
    assertFalse(shouldBlockForeground(restrictions, "com.android.permissioncontroller", context.packageName, protectedPackages, ForegroundSafety()))
    assertTrue(shouldBlockForeground(restrictions, "com.example.blocked", context.packageName, protectedPackages, ForegroundSafety()))
  }

  @Test
  fun `settings app is not globally exempt during an active restriction`() {
    assertTrue(
      shouldBlockForeground(
        restrictions,
        "com.android.settings",
        context.packageName,
        protectedForegroundPackages(context),
        ForegroundSafety(),
      ),
    )
  }

  @Test
  fun `launchable app filtering excludes disabled and protected packages`() {
    val excludedPackages = setOf(
      context.packageName,
      "com.example.launcher",
      "com.android.systemui",
      "com.example.keyboard",
      "com.android.permissioncontroller",
    )
    val candidates = listOf(
      LaunchableAppCandidate("com.example.notes", "Notes", enabled = true, applicationFlags = 0),
      LaunchableAppCandidate("com.example.disabled", "Disabled", enabled = false, applicationFlags = 0),
      LaunchableAppCandidate("com.example.launcher", "Launcher", enabled = true, applicationFlags = ApplicationInfo.FLAG_SYSTEM),
      LaunchableAppCandidate("com.example.keyboard", "Keyboard", enabled = true, applicationFlags = 0),
      LaunchableAppCandidate("com.example.service", "Service only", enabled = true, applicationFlags = 0, hasLaunchActivity = false),
      LaunchableAppCandidate("com.example.suspended", "Suspended", enabled = true, applicationFlags = ApplicationInfo.FLAG_SUSPENDED),
      LaunchableAppCandidate("com.example.updated", "Updated system app", enabled = true, applicationFlags = ApplicationInfo.FLAG_UPDATED_SYSTEM_APP),
    )

    val result = filterLaunchableApps(candidates, excludedPackages)

    assertEquals(listOf("com.example.notes", "com.example.updated"), result.map { it.packageName })
  }

  @Test
  fun `app icon encoder returns a compressed png data uri`() {
    val encoded = encodeAppIconDataUri(ColorDrawable(Color.RED))

    assertNotNull(encoded)
    assertTrue(encoded!!.startsWith("data:image/png;base64,"))
  }

  @Test
  fun `restriction snapshot keeps task title and formats remaining focus time`() {
    FocusRestrictionState.write(context, restrictions)

    assertEquals("复习数学错题", FocusRestrictionState.read(context).taskTitle)
    assertEquals("剩余 25 分钟", formatRemainingFocusTime(25 * 60_000L))
    assertEquals("剩余不足 1 分钟", formatRemainingFocusTime(30_000L))
  }

  @Test
  fun `blocker analytics are debounced and never expose the blocked app`() {
    RestrictionAnalyticsStore.recordBlocked(context, "focus-1", "com.example.private", 1_000L)
    RestrictionAnalyticsStore.recordBlocked(context, "focus-1", "com.example.private", 2_000L)
    RestrictionAnalyticsStore.recordBlockerShown(context, "focus-1", 2_500L)

    val events = RestrictionAnalyticsStore.drain(context)

    assertEquals(listOf("app_blocked", "whitelist_blocker_shown"), events.map { it["event"] })
    assertEquals(mapOf("sessionId" to "focus-1"), events.first()["props"])
    assertFalse(events.toString().contains("com.example.private"))
  }

  @Test
  fun `launchable app map uses typescript icon data url field`() {
    val app = LaunchableAppCandidate(
      packageName = "com.example.notes",
      label = "Notes",
      enabled = true,
      applicationFlags = ApplicationInfo.FLAG_INSTALLED,
      icon = ColorDrawable(Color.RED),
    )

    val mapped = launchableAppToMap(app)

    assertTrue(mapped["iconDataUrl"].toString().startsWith("data:image/png;base64,"))
    assertFalse(mapped.containsKey("icon"))
  }
}
