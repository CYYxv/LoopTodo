---
doc_type: feature-review
feature: 2026-07-12-mobile-polish-accessibility
status: passed
---
# Mobile Polish Accessibility 代码审查
- 审查覆盖小于 360dp、2 倍字体、深色状态栏、减少动态效果、标签导航和核心表单控件。
- 横向导航改为可滚动标签列表，避免九个入口在窄屏或大字体下拥挤。
- 模式、任务类型和联网策略使用单选语义并暴露选中状态；开关具有可访问标签。
- 本地恢复状态使用进度语义，错误卡使用警告角色和实时播报。
- 测试环境显式模拟视频和 WebView 原生模块，不改变运行时实现。
- 结论：无未解决的 blocking 或 important 问题。

