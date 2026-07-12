# LoopTodo / 闭环 Todo

LoopTodo 是 Android 优先的反拖延待办与专注应用，覆盖任务、习惯、专注/锁机、强制触发、可信资源、AI、统计、社交竞技、订阅、家庭和奖励闭环。

## 项目结构

- `apps/mobile`：Expo Router + React Native + TypeScript，使用 SQLite 保存离线任务与会话，并包含 Kotlin Android 锁机模块。
- `apps/api`：NestJS + Fastify + Prisma + PostgreSQL + Redis，提供认证、同步、实时社交和后台业务 API。
- `compose.yaml`：本地 PostgreSQL、Redis、API 环境；API 启动前自动执行 Prisma migrations。

## 本地环境

```bash
docker compose up --build
```

移动端：

```bash
cd apps/mobile
npm ci
npm run android
```

Android SDK 可通过 `ANDROID_HOME` / `ANDROID_SDK_ROOT` 指向自定义目录。本项目开发环境使用 `H:\Android\sdk`。

## 验证命令

```bash
cd apps/api
npm run prisma:validate
npm run typecheck
npm test
npm run build

cd ../mobile
npm run typecheck
npm test -- --runInBand
npx expo export --platform android --output-dir .expo-export-check
npx expo prebuild --platform android --no-install
android\gradlew.bat -p android :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --no-daemon
```

## 安全边界

- 锁机能力依赖 Android 通知、通知监听、前台服务、精确闹钟及可选无障碍权限；不承诺所有厂商系统绝对不可绕过。
- 家长只能下发任务、审批修改和查看关联孩子状态，不能远程直接锁机。
- AI 仅使用用户为当前任务选择的材料，审计不保存原始问题、答案或材料正文。
- 支付、推送与 AI provider 均通过 adapter 接入；生产环境必须提供真实凭证并禁用测试 provider。
- 奖励地址使用 AES-256-GCM 加密，仅奖励管理员在履约流程中可读取，访问会被审计。
