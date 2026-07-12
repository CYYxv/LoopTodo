# LoopTodo 1.0.0 交付说明

## 产物

- APK：`H:\LoopTodo\releases\1.0.0\LoopTodo-1.0.0-arm64-release.apk`
- AAB：`H:\LoopTodo\releases\1.0.0\LoopTodo-1.0.0-arm64-release.aab`
- SHA-256：`H:\LoopTodo\releases\1.0.0\SHA256SUMS.txt`

当前产物只包含 `arm64-v8a`，适用于绝大多数现代 Android 真机。包名为 `com.looptodo.app`，版本为 `1.0.0`，versionCode 为 `1`，minSdk 24，targetSdk 36。

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

## 验证结果

- Mobile typecheck：通过。
- Mobile Jest：12 suites / 29 tests 通过。
- Android production Expo export：通过。
- arm64 Release APK 和 AAB：构建通过。
- APK v2 签名校验：通过。
- APK 已移除悬浮窗和旧版外部存储权限。
- 当前无模拟器/真机，未执行安装、启动和 TalkBack 人工验收。

