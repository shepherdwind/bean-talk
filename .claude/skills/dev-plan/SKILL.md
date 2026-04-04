---
name: dev-plan
description: 将较大需求拆分为独立任务，逐个调用 /dev 完成开发
disable-model-invocation: true
argument-hint: [开发目标描述]
---

开发目标：$ARGUMENTS

编码规则见 `.claude/rules.md`，工作流和执行约束见 `AGENTS.md`。

## 流程

### 1. 设计计划总览

- 阅读设计文档（docs/ 目录）和现有代码，理解整体上下文
- 将目标拆分为可独立开发、独立提交的小任务
- 每个任务应有明确的输入输出和验收标准
- 任务之间按依赖关系排序
- 将任务拆分方案写入 `docs/tasks/plan.md`，内容包括：目标、任务列表（编号、名称、状态、依赖关系）、依赖图

### 2. Review 计划总览（最多 3 轮）

按优先级调用外部 agent review 检查 `docs/tasks/plan.md`：

- **优先级 1：Codex** — `codex review --uncommitted`
- **优先级 2：Gemini** — `gemini --approval-mode yolo -p "<review prompt>"`，传入 plan.md 内容，检查任务粒度、依赖顺序、缺失/重复任务
- **优先级 3：Self-review** — 如果 Codex 和 Gemini 都不可用，退化为 self-review，并明确记录

- 根据 review 返回的问题调整 `docs/tasks/plan.md`
- 修改后再次进行 review
- 最多 3 轮，3 轮后仍有分歧则列出交由用户决定

### 3. 提交计划总览

Review 通过后，向用户确认计划，然后 commit 并 push plan.md：

```bash
git add docs/tasks/plan.md
git commit -m "docs: add development plan"
git push origin main
```

### 4. 逐个创建任务文件

按 plan.md 中的任务顺序，依次创建每个任务的详细文件 `docs/tasks/NNN-<task-name>.md`。

每个任务文件包含：
- 任务目标
- 涉及的文件和模块
- 输入输出和验收标准
- 依赖的前置任务编号

每创建一个任务文件后：
1. 按优先级调用外部 agent review 检查该任务文件（Codex > Gemini > Self-review，最多 3 轮）
2. Review 通过后暂存并 commit：
   ```bash
   git add docs/tasks/NNN-<task-name>.md
   git commit -m "docs: add task NNN-<task-name>"
   ```

重复直到所有任务文件创建完毕。完成后 push 所有任务文件：

```bash
git push origin main
```

### 5. 执行第一个任务

启动独立子 agent（context: fork）执行 /dev，将第一个待执行的 task 文件内容作为参数：

- 子 agent 在独立上下文中完成：切分支 -> 实现 -> review -> 测试 -> 提交 PR
- 子 agent 完成后返回结果，更新 plan.md 中该任务状态为 `pr_created`，记录 PR 链接，并提交状态变更：
  ```bash
  git add docs/tasks/plan.md
  git commit -m "docs: update plan status for task NNN"
  ```
- 如果任务失败则标记为 `failed`，同样提交状态变更，并向用户报告

### 6. 等待 PR Review

PR 创建后，提示用户去 review。用户 review 通过并合并后，重新执行 `/dev`（不带参数）或 `/dev-master` 继续下一个任务。

plan.md 中的任务状态流转：`pending` -> `in_progress` -> `reviewed` -> `pr_created` -> `done`
