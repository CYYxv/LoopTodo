---
doc_type: feature-review
feature: 2026-07-11-lock-engine-spike
status: passed
reviewer: self
reviewed: 2026-07-11
round: 1
---

# Lock Engine Spike 审查

- 预研将可控能力、系统限制和产品承诺分开，未把 AccessibilityService、前台服务或 Device Admin 错当成绝对锁机保证。
- 强约束仅在用户主动授权后启用；Device Owner 模式只面向已受管设备。
- 厂商后台限制均有权限引导、持续通知和异常记录降级路径。
- 结论：可进入 `android-lock-engine` 实现，真机差异留给后续兼容阶段验证。
