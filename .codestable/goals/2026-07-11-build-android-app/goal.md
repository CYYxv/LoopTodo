---
doc_type: goal
goal: build-android-app
status: active
---

# 构建 LoopTodo Android 应用

## Objective

依据 `C:\Users\Administrator\Documents\番茄todo` 中的 PRD、技术文档和 MVP 设计文档，持续构建 LoopTodo Android 应用，直到核心 MVP 能力得到可运行、可验证、可追溯的实现。

## Starting Point

`H:\LoopTodo\apps\mobile` 已存在 Expo SDK 57、React Native、TypeScript、HeroUI Native 与 Uniwind 原型。原型包含待办首页、快速添加、专注/锁机流程预览、资源通行证、社交和家庭入口，但主要状态仍是内存模拟，仓库尚未初始化 Git。

## Acceptance Criteria

- 应用实现 PRD 的 Android MVP 核心任务闭环，并能在当前开发环境构建验证。
- 技术实现遵守技术文档中的分层、状态机、本地持久化与原生锁机边界。
- 每个重要功能完成独立代码审查、验证、提交并推送至 `https://github.com/CYYxv/LoopTodo`。
- 项目与主要依赖保留在 H 盘，产品英文名统一为 LoopTodo。

## Non-Goals

- 不在缺少设备兼容验证时声称锁机能力绝对不可绕过。
- 不实现 iOS、完整桌面端、视频下载或高侵入式第三方 App 内容识别。

## Decisions And Assumptions

- PRD 与技术文档是需求和架构权威来源。
- 日常技术选型由实现者负责；复杂能力优先采用成熟库并记录依据。
- 远端仓库当前为空，可从 H 盘现有原型建立首个提交历史。

## Current State

CodeStable 骨架已补齐，下一步先对现有交互原型执行独立代码审查和构建验证，避免把未知问题写入首个基线提交。

## Next Action

初始化 Git，审查现有 MVP 原型，修复阻塞问题并推送首个可验证基线。
