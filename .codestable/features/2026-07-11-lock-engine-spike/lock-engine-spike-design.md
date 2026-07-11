---
doc_type: feature-design
feature: 2026-07-11-lock-engine-spike
roadmap: complete-project
roadmap_item: lock-engine-spike
status: approved
summary: Android 锁机能力、权限、后台恢复与审核边界预研
tags: [android, lock, accessibility, policy]
---

# Android Lock Engine 预研结论

## 决策

LoopTodo 采用分级锁机能力，不宣称所有 Android 设备绝对不可绕过：

1. **标准商店版**：全屏锁机 Activity、前台服务、本地状态恢复、通知监听、权限实时检查、紧急入口。
2. **增强约束版**：用户明确授权 AccessibilityService 后，检测离开 LoopTodo 并引导返回；该能力必须独立披露、可关闭，并在上架前完成商店政策复核。
3. **受管设备版**：仅在 LoopTodo 成为 Device Owner 的专用设备场景使用 Lock Task Mode，提供接近 kiosk 的强约束；普通用户安装不能自动获得 Device Owner。

不使用已弱化且无法满足普通消费场景的传统 Device Admin 作为核心锁机方案，不依赖后台强拉起 Activity 作为唯一恢复手段。

## 业务不变量

- 进入锁机前必须实时检查必要权限，缺失时拒绝开始。
- 单次锁机最长三小时，结束时间和会话状态同时保存在原生 SharedPreferences 与 SQLite。
- 重启后由 BOOT_COMPLETED 恢复前台服务；无法自动展示页面时至少保持高优先级持续通知并引导返回。
- 紧急电话入口始终可达；110、119、120 通过系统拨号界面发起，LoopTodo 不直接拨号。
- 普通消费设备上的“无白名单”是产品交互规则，不等同于系统级不可绕过保证。

## 官方能力依据

- Lock Task Mode 需要 Device Policy Controller 将应用加入 allowlist；普通应用只能退化为用户可退出的 Screen Pinning：<https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode>
- Android 14 对后台全屏 Intent 和启动 Activity 限制更严格，不可把后台拉起作为唯一锁机保证：<https://developer.android.com/about/versions/14/behavior-changes-14#background-activity-restrictions>
- 前台服务必须声明类型并展示持续通知，Android 12+ 后台启动受限：<https://developer.android.com/develop/background-work/services/fgs>
- BOOT_COMPLETED 可用于恢复持久状态，但厂商自启动和省电策略仍可能拦截：<https://developer.android.com/develop/background-work/background-tasks/broadcasts>
- Accessibility API 用途需符合 Google Play 政策并向用户清晰披露，不得绕过平台安全控制：<https://support.google.com/googleplay/android-developer/answer/10964491>

## 兼容矩阵

| 环境 | 前台服务 | 重启恢复 | 无障碍返回 | 真正 Lock Task | 结论 |
| --- | --- | --- | --- | --- | --- |
| AOSP / Pixel Android 13-16 | 高 | 中高 | 高 | 仅 Device Owner | 标准实现基线 |
| Samsung One UI | 高 | 中 | 中高 | 仅 Device Owner | 需引导关闭电池优化 |
| Xiaomi HyperOS / MIUI | 中 | 低至中 | 中 | 仅 Device Owner | 必须引导自启动、后台弹出和省电白名单 |
| OPPO ColorOS / OnePlus | 中 | 低至中 | 中 | 仅 Device Owner | 必须引导自启动与后台运行权限 |
| vivo OriginOS | 中 | 低至中 | 中 | 仅 Device Owner | 必须引导高耗电后台和自启动 |
| Huawei HarmonyOS / EMUI | 中 | 低至中 | 中 | 仅 Device Owner | 无 GMS；推送和后台策略需厂商适配 |
| 企业/学校受管设备 | 高 | 高 | 不必依赖 | 高 | 可启用 Device Owner 专用模式 |

矩阵是桌面预研结果，不替代 `android-compatibility` 阶段的真机验收。

## AndroidLockEngine 边界

原生模块对 RN 暴露 `checkCapabilities`、`startLockSession`、`endLockSession`、`emergencyExit`、`getActiveSession` 和 `openPermissionSettings`。原生层独占状态机、前台服务、重启恢复和系统权限判断；RN 只负责业务确认与展示。

## 阻断条件

- 必要通知权限或前台服务能力不可用。
- 结束时间超过三小时或早于当前时间。
- 已存在未结束锁机会话。
- 用户未完成首次风险确认。
- 选择增强约束但 AccessibilityService 未启用。

## 审核与产品文案

- 商店版使用“强约束锁机”“降低绕过概率”，不得使用“绝对无法退出”。
- 无障碍授权页必须解释具体用途，不把授权与账号登录、基础待办绑定。
- 无障碍被关闭、设备重启恢复失败或前台服务被停止时，记录异常并通过已实现的通知事件上报。
