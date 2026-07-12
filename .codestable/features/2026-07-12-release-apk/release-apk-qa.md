---
doc_type: feature-qa
feature: 2026-07-12-release-apk
status: passed
---
# Release APK QA
- Mobile typecheck：通过。
- Mobile Jest：12 suites / 29 tests 通过。
- Production Android Expo export：通过。
- arm64 `assembleRelease` 与 `bundleRelease`：通过。
- APK v2 signature：通过；RSA 4096；证书 SHA-256 `F7AD8CE0492059DFA1F666E45C464DE2BA2B9D12C470885D712C5962FF783EB4`。
- APK SHA-256：`EFB936C23EB67B7EB9488727E4708F37DC2ED24A90746A9F23537E41865A5CB8`。
- AAB SHA-256：`1D0ECC2A31C5D97317FF906F43F7F5D2C244FABA42C240DC17559730FC7F5812`。
- 当前无模拟器/真机，安装启动与厂商人工验收未虚构通过。

