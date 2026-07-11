package com.looptodo.lockengine

import android.Manifest
import android.content.ContentValues
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.MediaStore
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class LockCameraActivity : ComponentActivity() {
  private var imageCapture: ImageCapture? = null
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (LockState.read(this) == null) return finish()
    val previewView = PreviewView(this)
    val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER }
    layout.addView(previewView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
    layout.addView(Button(this).apply { text = "拍照并返回"; setOnClickListener { capture() } })
    layout.addView(Button(this).apply { text = "返回锁机"; setOnClickListener { finish() } })
    setContentView(layout)
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) bind(previewView)
    else ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), CAMERA_REQUEST)
  }
  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == CAMERA_REQUEST && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) recreate() else finish()
  }
  private fun bind(previewView: PreviewView) {
    val future = ProcessCameraProvider.getInstance(this)
    future.addListener({
      val provider = future.get(); val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
      imageCapture = ImageCapture.Builder().build(); provider.unbindAll(); provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, imageCapture)
    }, ContextCompat.getMainExecutor(this))
  }
  private fun capture() {
    val capture = imageCapture ?: return
    val name = "LoopTodo_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())}"
    val values = ContentValues().apply { put(MediaStore.MediaColumns.DISPLAY_NAME, name); put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg"); put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/LoopTodo") }
    val output = ImageCapture.OutputFileOptions.Builder(contentResolver, MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values).build()
    capture.takePicture(output, ContextCompat.getMainExecutor(this), object : ImageCapture.OnImageSavedCallback {
      override fun onImageSaved(result: ImageCapture.OutputFileResults) { Toast.makeText(this@LockCameraActivity, "照片已保存，锁机结束后可查看", Toast.LENGTH_SHORT).show(); finish() }
      override fun onError(error: ImageCaptureException) { Toast.makeText(this@LockCameraActivity, "拍照失败", Toast.LENGTH_SHORT).show() }
    })
  }
  companion object { const val CAMERA_REQUEST = 4102 }
}
