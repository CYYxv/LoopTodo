---
doc_type: feature-qa
feature: 2026-07-12-trusted-resource-container
status: passed
tested: 2026-07-12
round: 1
---

# Trusted Resource Container QA

- Mobile typecheck：passed。
- URL policy / repository tests：2 suites / 3 tests passed。
- Android Hermes export：passed。
- arm64 `:app:assembleDebug`：passed，包含 WebView、DocumentPicker、FileSystem、Crypto 和 Expo Video 原生模块。
- 覆盖精确 URL、域名与子域、恶意相似域、深链、HTTP、信息流路径和活动会话只读保护。
