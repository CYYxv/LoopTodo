---
doc_type: feature-review
feature: 2026-07-12-android-compatibility
status: passed
---
# Android Compatibility 代码审查
- OEM 深链覆盖 Xiaomi/Redmi、OPPO/OnePlus/realme、vivo/iQOO、Huawei、Honor、Samsung。
- 每个 Intent 都先检查可解析 Activity；系统升级导致组件失效时回退应用详情页。
- 未使用宽泛异常吞掉失败，最终启动失败会通过原生 Promise 返回到 store 错误状态。
- 设备信息仅用于本地权限提示，不上传或写入审计。
- 兼容文档没有把静态构建冒充真机结果，并保留 Device Owner 能力边界。
- 结论：无未解决的 blocking 或 important 代码问题。

