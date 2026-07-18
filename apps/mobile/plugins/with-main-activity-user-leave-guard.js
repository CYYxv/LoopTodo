const { withMainActivity } = require('@expo/config-plugins')

const guardMethod = `  override fun onUserLeaveHint() {
    try {
      super.onUserLeaveHint()
    } catch (error: NullPointerException) {
      Log.w("LoopTodo", "Ignored an early user-leave callback before React initialization", error)
    }
  }

`

function patchMainActivity(source) {
  if (source.includes('override fun onUserLeaveHint()')) return source
  if (!source.includes('import android.util.Log')) {
    source = source.replace('import android.os.Bundle', 'import android.os.Bundle\nimport android.util.Log')
  }
  const insertionPoint = '  override fun invokeDefaultOnBackPressed()'
  if (!source.includes(insertionPoint)) throw new Error('Unable to locate MainActivity insertion point')
  return source.replace(insertionPoint, `${guardMethod}${insertionPoint}`)
}

function withMainActivityUserLeaveGuard(config) {
  return withMainActivity(config, (result) => {
    if (result.modResults.language !== 'kt') throw new Error('LoopTodo MainActivity guard requires Kotlin')
    result.modResults.contents = patchMainActivity(result.modResults.contents)
    return result
  })
}

module.exports = withMainActivityUserLeaveGuard
module.exports.patchMainActivity = patchMainActivity
