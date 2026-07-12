---
doc_type: feature-review
feature: 2026-07-12-release-apk
status: passed
---
# Release APK 代码审查
- 发布前发现并修复云端功能从未由移动端认证会话配置的 blocking 问题。
- refresh token 与短期 access token 使用 SecureStore；刷新成功后统一替换所有 API/WebSocket client token。
- API 地址校验阻止普通远程 HTTP，避免账号凭证明文传输。
- Release signing 插件不在仓库保存密码，且 release task 缺属性时失败，不允许静默 debug 签名。
- 权限审查移除 `SYSTEM_ALERT_WINDOW`、`READ_EXTERNAL_STORAGE`、`WRITE_EXTERNAL_STORAGE`。
- 交付测试证书名称明确包含 Delivery Test Only，发布说明明确不能用于冒充商店正式签名。
- 结论：无未解决的 blocking 或 important 代码问题。

