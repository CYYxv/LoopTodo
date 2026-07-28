package com.looptodo.lockengine

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.util.Base64
import android.view.inputmethod.InputMethodManager
import java.io.ByteArrayOutputStream

data class LaunchableAppCandidate(
  val packageName: String,
  val label: String,
  val enabled: Boolean,
  val applicationFlags: Int,
  val installed: Boolean = true,
  val hasLaunchActivity: Boolean = true,
  val icon: Drawable? = null,
)

fun filterLaunchableApps(
  candidates: List<LaunchableAppCandidate>,
  excludedPackages: Set<String>,
): List<LaunchableAppCandidate> = candidates
  .asSequence()
  .filter { it.installed && it.enabled && it.hasLaunchActivity }
  .filterNot { it.applicationFlags and ApplicationInfo.FLAG_SUSPENDED != 0 }
  .filterNot { it.packageName in excludedPackages }
  .distinctBy { it.packageName }
  .sortedBy { it.label.lowercase() }
  .toList()

fun resolveLaunchableApps(context: Context): List<Map<String, Any?>> {
  val manager = context.packageManager
  val launchIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
  val excludedPackages = excludedLaunchablePackages(context)
  val candidates = manager.queryIntentActivities(launchIntent, 0).mapNotNull { resolveInfo ->
    val activity = resolveInfo.activityInfo ?: return@mapNotNull null
    val application = activity.applicationInfo ?: return@mapNotNull null
    val packageName = activity.packageName ?: return@mapNotNull null
    LaunchableAppCandidate(
      packageName = packageName,
      label = resolveInfo.loadLabel(manager).toString().ifBlank { packageName },
      enabled = activity.enabled && application.enabled,
      applicationFlags = application.flags,
      installed = application.flags and ApplicationInfo.FLAG_INSTALLED != 0,
      hasLaunchActivity = manager.getLaunchIntentForPackage(packageName) != null,
      icon = runCatching { resolveInfo.loadIcon(manager) }.getOrNull(),
    )
  }
  return filterLaunchableApps(candidates, excludedPackages).map(::launchableAppToMap)
}

fun launchableAppToMap(app: LaunchableAppCandidate): Map<String, Any?> = mapOf(
  "packageName" to app.packageName,
  "label" to app.label,
  "iconDataUrl" to app.icon?.let(::encodeAppIconDataUri),
)

fun encodeAppIconDataUri(drawable: Drawable): String? = try {
  val size = 96
  val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
  val canvas = Canvas(bitmap)
  drawable.setBounds(0, 0, size, size)
  drawable.draw(canvas)
  val output = ByteArrayOutputStream()
  if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) null
  else "data:image/png;base64,${Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)}"
} catch (_: RuntimeException) {
  null
} catch (_: OutOfMemoryError) {
  null
}

private fun excludedLaunchablePackages(context: Context): Set<String> = buildSet {
  add(context.packageName)
  add("com.android.systemui")
  add("com.android.permissioncontroller")
  add("com.google.android.permissioncontroller")

  val manager = context.packageManager
  val homeIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
  manager.queryIntentActivities(homeIntent, 0).mapNotNullTo(this) { it.activityInfo?.packageName }

  val inputMethodManager = context.getSystemService(InputMethodManager::class.java)
  inputMethodManager?.enabledInputMethodList?.mapTo(this) { it.packageName }

  manager.resolveActivity(Intent("android.intent.action.MANAGE_PERMISSIONS"), 0)
    ?.activityInfo?.packageName?.let { add(it) }
}
