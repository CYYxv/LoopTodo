declare const require: (moduleName: string) => any

const { patchMainActivity } = require('../../../plugins/with-main-activity-user-leave-guard')

test('guards early user-leave callbacks before the React delegate is ready', () => {
  const source = patchMainActivity(`package com.looptodo.app

import android.os.Bundle

class MainActivity : ReactActivity() {
  override fun invokeDefaultOnBackPressed() {}
}
`)

  expect(source).toContain('override fun onUserLeaveHint()')
  expect(source).toContain('catch (error: NullPointerException)')
  expect(patchMainActivity(source)).toBe(source)
})
