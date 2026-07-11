# Attention

本文件是 CodeStable 技能启动必读的项目注意事项入口。所有 CodeStable 子技能开始工作前必须读取它。

## 报告语言

CodeStable 所有人读报告正文使用中文；YAML、JSON、frontmatter 和代码标识保持机器可读格式。

## 项目碎片知识

### 编译与构建

- Android 客户端位于 `H:\LoopTodo\apps\mobile`，使用 Expo SDK 57、React Native、TypeScript 与 HeroUI Native。
- 写代码前必须阅读 `https://docs.expo.dev/versions/v57.0.0/` 对应版本文档。

### 运行与本地起服务

- 优先把项目文件、依赖和开发环境放在 H 盘。

### 测试

- 移动端基础验证至少包含 `npm run typecheck` 和 Android 平台 Expo export。

### 命令与脚本陷阱

### 路径与目录约定

- PRD、技术文档和 MVP 设计文档的权威来源位于 `C:\Users\Administrator\Documents\番茄todo`。
- 产品英文名固定为 `LoopTodo`。

### 环境变量与凭证

### 其他

- 每完成一个重要功能，先进行独立代码审查，再提交并推送到 `https://github.com/CYYxv/LoopTodo`。
- 遇到复杂能力时优先调研成熟方案或库，不盲目自研。
- owner 已将常规技术选型、流程确认、独立 reviewer 不可用时的本地审查降级、分支、commit 和 push 授权给 agent，不再逐项询问。
- secrets、外部购买、破坏性操作、生产部署、应用商店发布和不可逆数据迁移仍必须停下来确认。
