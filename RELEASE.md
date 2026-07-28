# LoopTodo 1.0.0 交付说明

## 产物

- APK：`H:\LoopTodo\releases\1.0.0\LoopTodo-1.0.0-arm64-release.apk`
- x86_64 APK：`H:\LoopTodo\releases\1.0.0\LoopTodo-1.0.0-x86_64-release.apk`
- AAB：`H:\LoopTodo\releases\1.0.0\LoopTodo-1.0.0-arm64-release.aab`
- SHA-256：`H:\LoopTodo\releases\1.0.0\SHA256SUMS.txt`

arm64 APK 只包含 `arm64-v8a`，适用于绝大多数现代 Android 真机；x86_64 APK 用于对应架构的模拟器。包名为 `com.looptodo.app`，版本为 `1.0.0`，versionCode 为 `1`，minSdk 24，targetSdk 36。

## 签名声明

当前使用明确标识为 **Delivery Test Only** 的交付测试 keystore：

- Keystore：`H:\LoopTodo\keystores\looptodo-delivery-test.jks`
- 本地属性：`H:\LoopTodo\keystores\looptodo-delivery-test.properties`
- 证书 SHA-256：`F7AD8CE0492059DFA1F666E45C464DE2BA2B9D12C470885D712C5962FF783EB4`

该签名可用于安装验收和持续升级测试，但不能冒充应用商店正式签名。正式上架前必须由 owner 提供并离线保管商店 keystore，再使用相同 release signing 属性重建。

## 生产配置

- API 模板：`apps/api/.env.production.example`
- Mobile 模板：`apps/mobile/.env.production.example`
- 签名模板：`apps/mobile/release-signing.properties.example`

未预置 `EXPO_PUBLIC_API_URL` 时，用户可在应用账号卡片输入 HTTPS API 地址；本机调试允许 localhost、127.0.0.1 和 Android 模拟器 `10.0.2.2` 的 HTTP 地址。

## 软件白名单 v1.2.6 Development Build

- APK：`H:\LoopTodo\releases\current\LoopTodo-development-arm64-latest.apk`
- SHA-256：`F1FE75D48CB206B51A7460CB17B379ED0A558FD3F92F2782E093633C69F7D044`
- 架构：仅 `arm64-v8a`，用于 Android 真机 Development Build 调试。
- 构建校验：已确认包含 `PACKAGE_USAGE_STATS`、`SYSTEM_ALERT_WINDOW`、前台服务、`WhitelistBlockedActivity` 和 `FocusRestrictionProbeActivity`，且不包含 `LockAccessibilityService`。
- 未完成项：尚未连接 Xiaomi/HyperOS 真机，不能把拦截页 3 秒返回、Home/Recent 防绕过、权限撤销和退出登录清理标记为真机验收通过。

## 旧版 1.0.0 产物验证结果（不代表软件白名单 v1.2.6 验收完成）

- Mobile typecheck：通过。
- Mobile Jest：15 suites / 37 tests 通过。
- Android production Expo export：通过。
- arm64 Release APK/AAB 与 x86_64 Release APK：构建通过。
- 两个 APK 的 v2 签名校验：通过。
- 该 2026-07-13 旧版 APK 未包含当前软件白名单所需的 `PACKAGE_USAGE_STATS` / `SYSTEM_ALERT_WINDOW`，且仍注册旧 `LockAccessibilityService`；不满足软件白名单 v1.2.6 发布门槛，必须重新构建并验证。
- UI 已重构为登录入口、今日/专注/数据/我的四栏导航和独立全屏专注页。
- 软件白名单 v1.2.6 的最新 Development Build、无 AccessibilityService 合并 Manifest 验证、Xiaomi/HyperOS 真机验收及连续切换测试尚未完成。
