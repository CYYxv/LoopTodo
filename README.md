# LoopTodo / 闭环todo

LoopTodo 是一款 Android 优先的反拖延待办与专注应用，核心目标是帮助用户把任务从“记录”推进到“开始、执行、完成、复盘”的闭环。

## 当前进度

- `apps/mobile`：Expo + React Native + TypeScript 移动端工程。
- UI 基础：已接入 HeroUI Native、Uniwind、React Native Gesture Handler、Reanimated / Worklets。
- MVP 原型：已完成待办首页、快速添加任务、专注/锁机模式预览、任务资源通行证、战队与家庭入口。

## 本地运行

```bash
cd apps/mobile
npm install
npm run android
```

## 验证命令

```bash
cd apps/mobile
npm run typecheck
npx expo export --platform android --output-dir .expo-export-check --clear
```

## 重要边界

- 当前锁机能力是产品流程原型，尚未实现 Android 原生锁机引擎。
- 后续需要对 Android 厂商权限、重启恢复、防卸载和无障碍能力做专项技术预研。
