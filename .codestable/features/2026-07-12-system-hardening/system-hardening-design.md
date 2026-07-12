---
doc_type: feature-design
feature: 2026-07-12-system-hardening
roadmap_item: system-hardening
status: approved
---
# System Hardening 设计
- 对 API 执行 Prisma 校验、类型检查、完整 Jest 与生产 TypeScript 构建。
- 对移动端执行类型检查、完整 Jest、Android Expo export 与 arm64 原生 Gradle 编译。
- 校验数据库 migration 目录连续且按时间前缀排序。
- 修复本地 Docker API 启动配置：开发环境允许 test adapter、启动前自动 migrate、运行镜像保留 Prisma CLI。
- 更新 README，删除“尚未实现原生锁机”的过时说明并列出真实安全边界。

