---
doc_type: feature-review
feature: 2026-07-11-api-foundation-auth
status: passed
reviewer: self
reviewed: 2026-07-11
round: 1
---

# API Foundation Auth 代码审查报告

## 范围与结论

- owner 已批准本地审查降级；本轮对认证、Prisma、Redis、测试和容器配置执行一次审查。
- 密码仅保存 Argon2id hash，refresh token 仅保存 SHA-256 摘要；响应不会返回密码 hash。
- refresh 通过数据库条件更新原子轮换，logout 撤销当前 device session，access/refresh 密钥与 token type 分离。
- Redis 故障明确失败关闭，不静默绕过认证限流。

## 已修复发现

- blocking: 同一秒签发的 refresh JWT 最初可能完全相同，导致轮换后旧 token 可重放；已加入随机 `jti`，e2e 证明重放返回 401。
- important: 并发注册可能绕过预查询并触发 Prisma 唯一约束 500；已映射 `P2002` 为稳定 `EMAIL_EXISTS` 冲突错误。

## Residual Risk

- 当前机器无 Docker，未连接真实 PostgreSQL/Redis；Prisma schema/migration 已校验，adapter 通过类型检查，外部进程集成留给后续系统环境阶段。

## Verdict

- Status: passed
- 无 unresolved blocking 或 important finding。
