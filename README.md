# LoopTodo / 闭环todo

LoopTodo 是一款 Android 优先的反拖延待办与专注应用，核心目标是帮助用户把任务从“记录”推进到“开始、执行、完成、复盘”的闭环。

## 当前进度

- `apps/mobile`：Expo Router + React Native + TypeScript 移动端工程，已具备 SQLite 本地任务闭环。
- `apps/api`：NestJS + Fastify + Prisma API，已实现邮箱密码与可撤销设备会话认证。
- UI 基础：已接入 HeroUI Native、Uniwind、React Native Gesture Handler、Reanimated / Worklets。
- 本地闭环：支持倒计时、正计时、不计时、定目标完成量、休息和重启恢复。

## 本地运行

```bash
cd apps/mobile
npm install
npm run android
```

API 依赖 PostgreSQL 与 Redis。安装 Docker 后可运行：

```bash
docker compose up --build
docker compose exec api npx prisma migrate deploy
```

当前机器未安装 Docker 时，可在 `apps/api` 使用 `.env.example` 配置已有 PostgreSQL/Redis 后运行 `npm run dev`。

## 验证命令

```bash
cd apps/mobile
npm run typecheck
npx expo export --platform android --output-dir .expo-export-check --clear

cd ../api
npm run prisma:validate
npm run typecheck
npm test
npm run build
```

## 重要边界

- 当前锁机能力尚未实现 Android 原生锁机引擎。
- 后续需要对 Android 厂商权限、重启恢复、防卸载和无障碍能力做专项技术预研。
