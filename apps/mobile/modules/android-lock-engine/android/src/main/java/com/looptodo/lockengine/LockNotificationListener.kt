package com.looptodo.lockengine

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class LockNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(notification: StatusBarNotification?) {
    if ((LockState.read(this) == null && !FocusRestrictionState.read(this).blockNotifications) || notification == null) return
    val allowedAlarm = notification.packageName.contains("deskclock", true) || notification.packageName.contains("clock", true)
    if (!allowedAlarm && notification.packageName != packageName) cancelNotification(notification.key)
  }
}
