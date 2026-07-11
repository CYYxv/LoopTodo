---
doc_type: feature-design
feature: 2026-07-11-api-foundation-auth
requirement:
roadmap: complete-project
roadmap_item: api-foundation-auth
status: approved
summary: 建立 NestJS、Prisma、PostgreSQL、Redis 与可撤销设备会话认证
tags: [api, auth, prisma, redis]
---

# API Foundation Auth 设计

## 1. 目标与边界

实现技术文档 AuthModule 与 `/auth/register`、`/auth/login`、`/auth/refresh`、`/auth/logout`、`/me`。密码使用 Argon2id；短期 access token 与轮换 refresh token 分离；每次登录建立设备会话，refresh token 只保存不可逆摘要并可按设备撤销。Redis 承载认证限流，PostgreSQL/Prisma 是用户和设备会话事实来源。

本 feature 不实现邮箱验证、找回密码、OAuth、用户设置更新、任务 API 或生产部署。

## 2. 关键决策

1. 使用 NestJS 11 + Fastify adapter，模块按 `auth/users/infrastructure` 组织。
2. Prisma 6.19 保持成熟 schema/migration 工作流，数据库模型使用 UUID、UTC 时间和唯一邮箱。
3. 业务服务依赖 `AuthRepository` 与 `AuthRateLimiter` port；Prisma、Redis 是 adapter，测试不依赖外部进程。
4. refresh JWT 包含 `sub`、`sessionId`、`type=refresh`；数据库保存 SHA-256 摘要并以 `updateMany` 原子轮换，旧 token 立即失效。
5. access JWT 包含 `sub`、`sessionId`、`type=access`；Guard 只接受 access 类型。
6. API 统一返回 `{data,error}`；异常 filter 输出稳定错误码，不泄露密码、hash 或 token 内部错误。

## 3. 数据模型

- `User`：`id/email/passwordHash/nickname/vipStatus/privacySettings/multiDeviceFocusSync/timestamps`。
- `DeviceSession`：`id/userId/deviceName/refreshTokenHash/expiresAt/revokedAt/lastUsedAt/timestamps`。
- 用户删除级联删除设备会话；邮箱唯一；会话按 user、revoked、expires 建索引。

## 4. 验收场景

1. 新邮箱注册返回用户与 token pair，重复邮箱返回稳定冲突错误。
2. 正确密码登录创建独立设备会话；错误邮箱/密码统一返回认证失败。
3. refresh 原子轮换，旧 refresh token 再用失败。
4. logout 撤销当前 device session，之后 refresh 失败。
5. access token 可访问 `/me`，refresh token 或无 token 不可访问。
6. 登录/注册通过 Redis 限流；Redis 失败明确返回服务不可用，不静默跳过安全边界。
7. Prisma schema、migration、typecheck、unit/e2e 测试和 production build 通过。
