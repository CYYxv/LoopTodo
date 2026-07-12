---
doc_type: feature-design
feature: 2026-07-12-release-apk
roadmap_item: release-apk
status: approved
---
# Release APK 设计
- 补齐移动端账号登录/注册、SecureStore refresh token、自动刷新和全部云模块统一配置，避免发布包只有未接线页面。
- 生产 API 仅允许 HTTPS，本机和模拟器调试地址例外。
- 使用 Expo config plugin 注入可复现的 release signing，release 任务缺签名属性时直接失败。
- 生成明确标识的交付测试 keystore，不冒充商店正式签名。
- 构建 arm64 Release APK/AAB，校验签名、包信息、权限和 SHA-256。
- 阻断 Expo 默认悬浮窗与旧外部存储权限，保留锁机、通知、相机、重启和精确闹钟必需权限。

