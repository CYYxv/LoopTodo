---
doc_type: feature-design
feature: 2026-07-12-android-compatibility
roadmap_item: android-compatibility
status: approved
---
# Android Compatibility 设计
- 在原生能力返回中加入 manufacturer、SDK 和厂商设置入口状态。
- 为主流国产厂商和 Samsung 提供已知自启动/电池管理设置 Intent。
- 所有 OEM Intent 在启动前使用 PackageManager 解析，不可用时回退应用详情页，禁止崩溃或静默失败。
- 设置页显示设备信息，并明确引导自启动、后台运行和后台弹出。
- 兼容矩阵严格区分代码/构建验证与真机人工验证，不承诺绝对不可绕过。

