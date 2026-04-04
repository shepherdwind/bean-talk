---
name: dev-master
description: 协调派发任务到子 agent，每个子 agent 执行 /dev 流程
disable-model-invocation: true
argument-hint: [起始任务编号，留空则从第一个 pending 开始]
---

起始任务：$ARGUMENTS

## 概述

读取 `docs/tasks/plan.md`，按依赖顺序逐个派发子 agent 执行任务。每个子 agent 在独立上下文中运行 `/dev` 流程（实现 → 测试 → Cross-Agent Review → 提交 PR）。主 agent 不写代码，只做协调、验证和状态管理。

优先遵循 `AGENTS.md`。

## 流程

### 1. 读取计划

- 读取 `docs/tasks/plan.md`，提取所有任务及其状态和依赖关系
- 确定起始任务：
  - 如果用户指定了编号，从该任务开始
  - 否则找到第一个 `pending` 任务
- 检查已有 `pr_created` 的任务：通过 `gh pr view` 确认是否已合并，更新为 `done`
- 确认所有前置依赖任务已 `done`

### 2. 逐个派发任务

对每个待执行任务，按顺序执行以下步骤：

#### 2a. 准备上下文

读取任务文件和相关上下文，准备传给子 agent 的完整信息：

- 任务文件全文（`docs/tasks/NNN-xxx.md`）
- 设计文档中与该任务相关的章节
- `AGENTS.md` 编码规范
- 前置任务的产出（如有需要了解的接口、类型等）

#### 2b. 派发子 agent

使用 Agent 工具派发子 agent，prompt 模板：

```
你正在执行 Trade Hub 项目的任务 NNN：<任务名称>

## 执行流程

严格按照 `.claude/skills/dev/SKILL.md` 中定义的 /dev 流程执行：
1. 确认任务（任务编号：NNN）
2. 切分支
3. 规划（阅读任务文件和设计文档）
4. 实现
5. 测试（强制门禁：全部通过才能继续）
6. Cross-Agent Review（按 `AGENTS.md` 优先级选择：Codex > Gemini > Self-review，最多 3 轮）
7. 提交并创建 PR

## 任务文件

<粘贴任务文件全文>

## 编码规范

<粘贴 AGENTS.md 全文>

## 设计参考

<粘贴相关设计文档章节>

## 上下文

<前置任务产出的关键信息，如已有的类型定义、接口等>

## 重要规则

- 先读 `.claude/skills/dev/SKILL.md` 了解完整流程
- 服务端代码必须写测试，测试全过才能继续
- Review 必须按 `AGENTS.md` 中的优先级执行（Codex > Gemini > Self-review），不要跳过
- commit message 和 PR body 使用英文
- 遇到问题不要猜测，报告回来

## 完成后报告

- 任务状态：DONE / BLOCKED / NEEDS_CONTEXT
- PR 链接（如果创建了）
- 实现概要
- 测试结果
- Review 结果（工具、轮数、修复的问题）
- 遇到的问题或担忧
```

#### 2d. 处理子 agent 结果

**DONE + PR 已创建：**
1. 验证 PR 存在：`gh pr view <PR#>`
2. 确认子 agent 已完成 cross-agent review，并将任务推进到 `reviewed`
3. 更新 `docs/tasks/plan.md` 中该任务状态为 `pr_created`，记录 PR 链接
4. 等待 CI：`gh pr checks <PR#> --watch`
5. CI 通过后合并：`gh pr merge <PR#> --squash --delete-branch`
6. 更新状态为 `done`
7. `git checkout main && git pull`
8. 继续下一个任务

**BLOCKED：**
1. 评估阻塞原因
2. 如果是上下文不足 → 补充上下文，重新派发
3. 如果是任务太复杂 → 用更强的模型重新派发
4. 如果是计划问题 → 暂停，报告给用户

**NEEDS_CONTEXT：**
1. 收集所需信息（读文件、查代码）
2. 补充到 prompt 中重新派发

**CI 失败：**
1. 查看失败日志：`gh run view <run-id> --log-failed`
2. 派发修复子 agent（传入失败日志 + 代码上下文）
3. 修复后重新等待 CI

### 3. 完成汇总

所有任务完成后：

1. 验证所有任务状态为 `done`
2. 列出所有 PR 链接
3. 报告整体完成情况

```markdown
## 执行汇总

| # | 任务 | 状态 | PR | Review |
|---|------|------|----|--------|
| 001 | monorepo-scaffold | done | #1 | gemini 1轮 |
| 002 | prisma-common | done | #2 | gemini 2轮 |
| ... | ... | ... | ... | ... |
```

## 规则

- **不在主 agent 中写代码** — 所有实现由子 agent 完成
- **不跳过 review** — 每个任务必须经过 `AGENTS.md` 定义的 cross-agent review
- **不并行派发** — 任务按依赖顺序串行执行，避免冲突
- **不忽略子 agent 上报的问题** — BLOCKED/NEEDS_CONTEXT 必须处理
- **依赖检查** — 派发前确认所有前置任务已 done
- **状态同步** — 每次状态变更立即更新 plan.md 并 commit
