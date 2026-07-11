---
doc_type: roadmap
slug: complete-project
status: active
created: 2026-07-11
last_reviewed: 2026-07-11
tags: [android, backend, full-product]
related_requirements: []
related_architecture: [closed-loop-todo-technical-document]
---

# LoopTodo 完整项目实施 Roadmap

## 1. 背景

当前仓库只有 Expo SDK 57 的 M0 交互原型。目标是完整落实 `闭环todo-PRD初稿.md` 与 `闭环todo-技术文档.md`：交付 Android 客户端、Kotlin 锁机引擎、TypeScript 后端、数据同步、可信资源、游戏化社交、家庭管理、商业化、奖励后台、测试与可安装 APK。

完成信号不是页面数量，而是核心任务从创建、专注或锁机、完成或失败、同步、统计、积分到家庭/社交可追溯闭环，并通过自动化验证与 Android 真机兼容验收。

## 2. 范围与明确不做

### 本 roadmap 覆盖

- Android 客户端、Expo Dev Client/prebuild、HeroUI Native、Zustand、SQLite。
- NestJS、Prisma、PostgreSQL、Redis、WebSocket 与 Docker 本地部署。
- 账号、多设备同步、待办、专注、锁机、强制触发、资源通行证、统计积分、社交战队、家庭、VIP 与奖励后台。
- 单元/API/组件/原生/兼容/安全/压力测试，以及 APK 构建和签名说明。

### 明确不做

- iOS、完整 Web/桌面客户端、视频下载和第三方 App 内容识别。
- 家长实时远程一键锁机、聊天型自习室、购买或转让紧急退出次数。
- 未获得 owner 凭证时的真实云部署、支付商户开通、推送厂商开通和应用商店上架。
- 不承诺所有 Android 厂商系统均绝对不可绕过；以兼容矩阵和风险提示为准。

### Granularity Gate

| 判断项 | 结论 |
|---|---|
| 为什么不是 single feature | 跨客户端、原生 Android、API、数据库、实时系统和运营后台，存在长期依赖 DAG。 |
| 为什么不是 brainstorm | PRD、技术栈、核心模块和首版验收标准已明确。 |
| roadmap 边界 | 完成技术文档定义的产品与工程交付；外部商业账号和生产部署需另行授权。 |
| 最小闭环 | `local-task-focus-loop` 完成后可离线创建任务、开始专注、完成/退出并重启恢复。 |

## 3. 模块拆分（概设）

```text
LoopTodo
├── Mobile App：页面、任务/会话编排、本地状态与同步队列
├── Android Lock Engine：权限、前台服务、锁机、重启恢复与紧急入口
├── App API：认证、任务、专注、家庭、社交、订阅和奖励业务
├── Data & Realtime：PostgreSQL、Redis、WebSocket、定时任务
├── Trusted Resources：受限浏览器、本地播放器、任务型 AI
└── Quality & Release：观测、安全、兼容测试、APK/部署产物
```

### Mobile App
- **职责**：承载用户交互、领域状态机、SQLite 缓存和离线同步；不直接计算最终积分。
- **子 feature**：`mobile-foundation`, `local-task-focus-loop`, `habit-goal-management`, `task-sync`, `trusted-resource-container`, `settings-privacy-controls`, `mobile-polish-accessibility`。
- **Depth**：业务状态集中在 store/repository，页面不直接读写 SQLite 或 HTTP。

### Android Lock Engine
- **职责**：封装系统权限、全屏 Activity、前台服务、重启恢复、紧急电话/拍照和厂商差异。
- **子 feature**：`lock-engine-spike`, `android-lock-engine`, `forced-trigger-scheduler`, `android-compatibility`。
- **Depth**：React Native 仅依赖稳定 bridge，不感知 Service/Receiver/Accessibility 细节。

### App API
- **职责**：提供认证、同步、任务、专注、积分、家庭、社交、订阅和奖励的权威业务规则。
- **子 feature**：`api-foundation-auth`, `task-focus-api`, `notification-delivery`, `scoring-statistics`, `social-realtime`, `teams-seasons`, `subscription-entitlements`, `family-management`, `reward-backoffice`。
- **Depth**：Controller 只做协议适配，业务不变量集中在 service/domain 层。

### Data & Realtime
- **职责**：持久化、幂等、乐观锁、追加式流水、排行榜缓存、WebSocket 和定时结算。
- **子 feature**：由各 API feature 按共享契约增量建立。
- **Depth**：Prisma/Redis/WebSocket 通过仓储或 gateway 隔离，避免业务层绑定供应商 API。

### Trusted Resources
- **职责**：限制网页、本地媒体和 AI 会话范围，记录资源变更审计和可信等级。
- **子 feature**：`trusted-resource-container`, `task-ai-service`。
- **Depth**：资源策略统一由 allowlist policy 判断，容器只执行结果。

### Quality & Release
- **职责**：可观测、安全、测试矩阵、Docker、APK、文档和发布检查。
- **子 feature**：`observability-security`, `system-hardening`, `release-apk`。

## 4. 模块间接口契约 / 共享协议

### 4.1 客户端领域仓储

```ts
type TaskStatus = 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
type TimerMode = 'countdown' | 'countup' | 'untimed';
type TrustLevel = 'high' | 'normal' | 'open' | 'invalid';
type SyncState = 'local' | 'pending' | 'synced' | 'conflict';

interface TaskRepository {
  list(): Promise<Task[]>;
  create(input: CreateTaskInput): Promise<Task>;
  update(id: string, version: number, patch: TaskPatch): Promise<Task>;
  markSessionActive(taskId: string, sessionId: string): Promise<void>;
}
```

约束：页面只调用 application action；当前会话、任务和待上传记录写 SQLite；历史会话追加写，不覆盖。

### 4.2 API 通用协议

```text
Base URL: /api/v1
Success: { data: T, error: null }
Failure: { data: null, error: { code: string, message: string, details?: object } }
写入会话必须携带 Idempotency-Key；时间以 UTC ISO8601 传输；任务更新携带 version。
错误：invalid_input, unauthorized, forbidden, not_found, version_conflict,
      duplicate_request, active_task_locked, quota_exhausted, internal_error
```

Dependency：移动端通过可替换 API client 调用；后端是 remote-owned seam，测试使用 HTTP test server，不伪造同名模块。

### 4.3 同步协议

```ts
type SyncMutation = {
  id: string;
  entityType: 'task' | 'focus_session' | 'lock_session' | 'resource_pass';
  entityId: string;
  operation: 'create' | 'update' | 'append';
  version: number | null;
  payload: unknown;
  createdAt: string;
};
```

约束：任务使用 version 乐观锁；专注、锁机和积分使用 append；网络恢复按创建顺序重放；服务端确认后才标 synced。

### 4.4 AndroidLockEngine Bridge

```ts
type LockCapability = { ready: boolean; missingPermissions: string[]; warnings: string[] };
type LockPlan = { sessionId: string; taskId: string; durationSeconds: number; allowCamera: boolean };

interface AndroidLockEngine {
  inspectCapability(): Promise<LockCapability>;
  start(plan: LockPlan): Promise<void>;
  getState(): Promise<'idle' | 'locking' | 'recovering'>;
  emergencyExit(reason: string): Promise<void>;
}
```

约束：`durationSeconds <= 10800`；权限缺失禁止 start；紧急额度由服务端权威、本地缓存兜底；原生 SharedPreferences 与 SQLite 双写；BOOT_COMPLETED 恢复。

### 4.5 资源策略

```ts
type ResourceType = 'url' | 'domain' | 'local_file' | 'local_video' | 'ai_material';
type ResourceDecision = { allowed: boolean; trustLevel: TrustLevel; reason: string | null };
evaluateResource(taskId: string, resource: ResourceRequest): Promise<ResourceDecision>;
```

约束：专注中新增资源必须产生审计记录并降低可信等级；不识别第三方 App 内部内容。

### 4.6 实时事件

```text
focus.state.changed { userId, deviceId, sessionId, mode, state, occurredAt }
room.member.changed  { roomId, userId, state, occurredAt }
score.updated        { userId, seasonId, total, pending, occurredAt }
family.alert.created { familyId, childId, alertType, occurredAt }
```

约束：事件带唯一 ID 并可幂等消费；WebSocket 断线后客户端通过 REST 快照恢复。

### 4.7 权限与隐私

- 普通用户只能访问自己的任务与记录；家庭共享必须校验当前成员关系和角色。
- 家长不能调用实时锁机接口；只下发任务和本地触发规则。
- AI 材料、失败原因、家庭历史、地址字段按最小权限返回；敏感操作写审计日志。

### 4.8 通知与权益

```ts
interface NotificationGateway {
  send(userId: string, type: string, payload: Record<string, unknown>): Promise<string>;
}
interface EntitlementService {
  check(userId: string, capability: string): Promise<{ allowed: boolean; source: 'free' | 'vip' | 'family' }>;
}
```

约束：本地提醒与远程推送共用事件类型；推送失败可重试且不回滚业务事务；权益判断只在服务端权威计算，客户端缓存仅用于展示。

## 5. 子 feature 清单

1. **mobile-foundation** — 拆分单文件原型，建立导航、领域类型、store/repository、测试与开发构建基线。
2. **local-task-focus-loop** — 使用 Zustand + SQLite 实现任务创建、三种计时、休息、完成/退出记录和重启恢复。
3. **api-foundation-auth** — 建立 NestJS/Prisma/PostgreSQL/Redis、邮箱密码认证、刷新 token 和设备会话。
4. **task-focus-api** — 实现任务、分类、专注/锁机会话、幂等、乐观锁和同步 API。
5. **habit-goal-management** — 实现习惯、定目标、完成量、单位、截止日期和强制约束配置。
6. **task-sync** — 实现移动端离线队列、冲突展示、多设备活跃任务锁和恢复同步。
7. **notification-delivery** — 实现本地提醒、FCM/厂商推送 adapter、重试和统一通知事件。
8. **lock-engine-spike** — 在主流 Android 机制上验证权限、前台服务、重启恢复和审核风险，输出兼容矩阵。
9. **android-lock-engine** — 实现 Kotlin 原生锁机 bridge、权限引导、最大时长、紧急入口和恢复状态。
10. **forced-trigger-scheduler** — 实现 10 分钟提醒、两次 20 分钟延迟、最终本地锁机和家长规则触发。
11. **trusted-resource-container** — 实现资源通行证、受限 WebView、本地播放器、审计和可信等级。
12. **task-ai-service** — 实现仅围绕任务材料的 AI 服务边界、会话审计和外部数据风险提示。
13. **scoring-statistics** — 实现历史明细、连续天数、可信分、服务端积分流水和可配置算法。
14. **social-realtime** — 实现好友、日 PK、公开/私密自习室、状态同步和励志表情。
15. **teams-seasons** — 实现排行榜、段位、赛季结算、战队与 1 万人规模缓存/压力测试。
16. **subscription-entitlements** — 实现 VIP 订阅状态、权益判断、习惯上限和支付 adapter。
17. **family-management** — 实现邀请码、多家长多孩子、任务下发、修改申请、状态、异常提醒和家庭权益规则。
18. **reward-backoffice** — 实现奖励配置、中奖通知、接受确认和地址权限控制的管理端/API。
19. **settings-privacy-controls** — 实现多设备同步开关、社交开关、权限检查、通知和数据可见性设置。
20. **mobile-polish-accessibility** — 完成全量页面空/加载/错误态、深色主题、字体放大、可访问 label 与小屏适配。
21. **observability-security** — 实现埋点、结构化日志、审计、家庭越权/邀请码/支付/地址安全测试。
22. **system-hardening** — 汇总单元、API、组件、原生、压力和回归测试，修复跨模块阻塞。
23. **android-compatibility** — 小米、华为、OPPO、vivo、荣耀、三星、Pixel 真机验证并形成风险提示。
24. **release-apk** — 完成本地 Docker 环境、production 配置模板、Android release APK/AAB 和安装验收。

**最小闭环**：第 2 条 `local-task-focus-loop` 完成后，离线任务执行闭环可独立演示和重启恢复。

### Goal Coverage Matrix

| Goal / completion signal | Covered by item(s) | Verification entry | Evidence type | Core? |
|---|---|---|---|---|
| 本地任务闭环与恢复 | 1,2 | 组件测试、SQLite 集成测试、Android 手工路径 | test + screenshot | yes |
| 账号、习惯、同步和数据恢复 | 3-7 | API e2e、多设备冲突、通知场景 | test + API evidence | yes |
| 原生锁机和强制触发 | 8-10,23 | 原生测试、重启/权限/厂商矩阵 | device evidence | yes |
| 可信资源闭环 | 11,12 | WebView 导航反例、本地媒体、AI 越界测试 | integration test | yes |
| 统计、积分和游戏化 | 13-15 | 算法单测、WebSocket e2e、压力测试 | test report | yes |
| 家庭、VIP、设置和奖励 | 16-19 | 权限矩阵、支付 adapter、后台流程 | API/UI evidence | yes |
| 可维护、安全、可发布 | 20-24 | 聚合测试、兼容报告、APK 安装 | audit + artifact | yes |

## 6. 排期思路

先建立工程和离线最小闭环；并行建立后端基础与高风险锁机预研。同步依赖本地和服务端模型；锁机实现依赖预研结论。可信资源、积分和家庭在核心任务 API 后推进；社交与战队依赖积分与实时基础；商业化依赖账号和权限。最后集中做 UI 收口、安全、压力、厂商兼容和 release APK。

Top 3 风险：Android 厂商限制与审核风险（先 spike + 兼容矩阵）；多设备/离线冲突导致记录重复（幂等 + append + version）；家庭/支付/地址越权（集中权限模型 + 安全测试）。

验证入口：移动端 typecheck/组件测试/Expo export/Gradle test；API unit/e2e；Docker smoke；Android instrumentation/真机矩阵；最终 APK 安装流程。

## 7. 观察项

- 联网策略采用“锁机和专注本地可执行、恢复网络后追加同步”，排行榜与家庭状态以服务端为准。
- 积分衰减和战队权重实现为服务端可配置规则；对应 feature 采用可解释默认值、单元测试和配置文档，不再单独请求常规授权。
- 用户退出家庭组后立即停止共享新数据；历史仅保留家庭下发任务及其执行记录，个人任务和退出后的记录不再向原家庭成员展示。
- 真实支付、推送、AI、对象存储、地图/厂商服务和生产部署需要 owner 提供账号、凭证与风险授权。
- 独立 reviewer 服务在原型阶段异常；后续 roadmap/design/code review 默认重试独立审查，不自动沿用本地降级。
