package com.looptodo.lockengine

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.provider.MediaStore
import android.telecom.TelecomManager
import android.view.accessibility.AccessibilityEvent

class LockAccessibilityService : AccessibilityService() {
  private var deviceEssentials: Set<String>? = null

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val now = System.currentTimeMillis()
    // 兜底：专注限制已过期则先自清，避免 app 被杀后残留状态永久困住用户。
    FocusRestrictionState.clearIfExpired(this, now)
    val session = LockState.read(this); val restrictions = FocusRestrictionState.read(this)
    // 锁机（enhanced）无过期约束；专注「阻止离开」受过期时间保护。
    val active = session?.enhanced == true || restrictions.blockLeavingActive(now)
    val type = event?.eventType
    if (!active || (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && type != AccessibilityEvent.TYPE_WINDOWS_CHANGED)) return
    val packageName = event.packageName?.toString() ?: return
    // 锁机模式（session != null）：忽略用户白名单，仅放行应急拨号/相机（PRD 3.4）。
    // 专注模式（session == null）：在设备必备集合之上叠加用户配置的全局白名单（PRD 3.3）。
    val allowed = if (session != null) resolveEssentials()
      else resolveEssentials() + restrictions.allowedPackages
    if (!allowed.contains(packageName)) {
      val intent = if (session != null) Intent(this, LockActivity::class.java) else packageManager.getLaunchIntentForPackage(applicationContext.packageName)
      intent?.let { startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)) }
    }
  }

  // 设备必备集合（可缓存）：自身 + 当前设备默认拨号/相机（运行时解析，兼容各厂商 ROM），解析失败时回退 AOSP 包名兜底。
  // 用户白名单不进此缓存，因为它在会话之间可变，需每次从 FocusRestrictionState 读取。
  private fun resolveEssentials(): Set<String> {
    deviceEssentials?.let { return it }
    val packages = linkedSetOf(applicationContext.packageName)
    defaultDialerPackage()?.let { packages.add(it) }
    defaultCameraPackage()?.let { packages.add(it) }
    packages.add("com.android.dialer"); packages.add("com.android.camera"); packages.add("com.android.camera2")
    return packages.also { deviceEssentials = it }
  }

  private fun defaultDialerPackage(): String? {
    getSystemService(TelecomManager::class.java)?.defaultDialerPackage?.let { if (it.isNotEmpty()) return it }
    return resolvePackage(Intent(Intent.ACTION_DIAL))
  }

  private fun defaultCameraPackage(): String? =
    resolvePackage(Intent(MediaStore.ACTION_IMAGE_CAPTURE)) ?: resolvePackage(Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA))

  private fun resolvePackage(intent: Intent): String? {
    val resolved = packageManager.resolveActivity(intent, 0)?.activityInfo?.packageName
    return if (resolved.isNullOrEmpty() || resolved == "android") null else resolved
  }

  override fun onInterrupt() = Unit
}
