---
doc_type: feature-design
feature: 2026-07-12-trusted-resource-container
roadmap: complete-project
roadmap_item: trusted-resource-container
status: approved
summary: 任务资源通行证、受限 WebView 和本地视频容器
tags: [mobile, webview, video, trust]
---

# Trusted Resource Container 设计

- 资源通行证按任务保存到 SQLite，类型包括精确 HTTPS 页面、HTTPS 域名、本地视频和本地文件。
- 专注开始后 repository 通过 `active_sessions` 强制只读，不能通过其他 UI 绕过。
- 精确页面只允许同一规范化 URL；域名模式只允许该域名及子域，并阻断 feed/recommend/shorts/explore/trending 等信息流路径。
- WebView 禁止 HTTP、深链、新窗口、画中画式外跳和下载；被拦截地址在容器内明确显示。
- 本地资源由 DocumentPicker 选择后复制到应用文档目录；视频使用 Expo Video，关闭全屏和画中画。
- 文件复制、SHA-256 指纹、数据库写入和删除清理统一在 repository 中执行，避免只读竞态和孤儿文件。
- 本地普通文件不调用外部应用打开，防止专注期间跳出可信环境。
