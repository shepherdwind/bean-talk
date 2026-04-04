---
name: dev
description: 基于任务计划执行开发，自动识别当前进度并继续
disable-model-invocation: true
argument-hint: [任务编号或需求描述，留空则自动继续下一个任务]
---

开发指令：$ARGUMENTS

编码规则见 `.claude/rules.md`，工作流和执行约束见 `AGENTS.md`。

## 流程

### 1. 确认当前任务

读取 `docs/tasks/plan.md`，确定要执行的任务：

- 如果用户指定了任务编号或需求，使用该任务
- 否则自动定位：
  - 找到最近一个 `pr_created` 的任务，通过 `gh pr view` 检查 PR 状态
  - 如果 PR 已合并，更新状态为 `done`
  - 如果 PR 未合并，提示用户先完成 review 和合并，然后停止
  - 找到下一个 `pending` 任务作为当前任务

将任务状态更新为 `in_progress`。

### 2. 切分支

```bash
git checkout main && git pull
git checkout -b <type>/<任务编号-简短描述>
```

分支前缀：`feat/`、`fix/`、`refactor/`。

### 3. 规划

- 阅读对应 task 文件和相关设计文档（docs/ 目录）
- 列出需要新增或修改的文件和关键步骤
- 非 trivial 任务向用户确认计划后再开始实现

### 4. 实现

按计划逐步编码。每步完成后自检是否符合项目规范（以 `AGENTS.md` 为准）。

### 5. 测试（强制门禁）

- 为新增或修改的核心逻辑补充单元测试
- 先运行最小必要验证，再运行 `npm test` 确保**全部通过**
- **测试未全部通过时，禁止进入后续步骤（review、commit、PR）**
- 如果测试失败，修复代码或测试后重新运行直到全部通过

### 6. Cross-Agent Review（最多 3 轮）

实现和测试完成后，调用外部 agent 进行 code review。按优先级选择可用的 review 工具：

**优先级 1：Codex**

```bash
# 未提交的变更（先 git add 暂存新文件）
codex review --uncommitted

# 已提交、对比 main 分支
codex review --base main
```

- **Codex 较慢，必须等待完整结果**：不要提前超时或结束，给足时间（如 120s）等 review 跑完再继续

**优先级 2：Gemini CLI**（Codex 不可用时）

分两轮 review。因为文件内容可能包含 shell 特殊字符，**必须先用 Write 工具把 prompt 写入临时文件，再用 `gemini -p @/tmp/review-prompt.txt`**，不要用 `$(cat ...)` 内联。

**第一轮：Spec 合规检查**

用 Write 工具创建 `/tmp/gemini-review-spec.txt`，内容模板：

```
你是 spec 合规审查员。

## 任务要求
<粘贴 docs/tasks/NNN-xxx.md 的内容>

## 编码规范
<粘贴 AGENTS.md 的内容>

## 你的工作
阅读实现代码，逐条对照任务要求验证：
1. 是否实现了所有要求的功能？
2. 是否有遗漏或多余的实现？
3. 是否符合 AGENTS.md 的编码规范？

报告格式：
- ✅ 合规（如果全部匹配）
- ❌ 问题列表（含 file:line 引用和具体问题描述）
```

然后执行：

```bash
gemini --approval-mode yolo -p @/tmp/gemini-review-spec.txt
```

**第二轮：代码质量检查**

用 Write 工具创建 `/tmp/gemini-review-quality.txt`，内容模板：

```
你是高级代码审查员。

## 变更范围
<粘贴 git diff --stat main...HEAD 的输出>

## 编码规范
<粘贴 AGENTS.md 的内容>

## 审查要点
1. 代码质量：关注分离、错误处理、类型安全、DRY
2. 架构：设计合理性、可扩展性、安全性
3. 测试：测试是否覆盖核心逻辑和边界情况
4. 文件职责：每个文件是否职责单一

## 报告格式
### 优点
### 问题
#### Critical（必须修复）
#### Important（应该修复）
#### Minor（建议改进）
每个问题包含：file:line、问题描述、原因、修复建议

### 结论
**可以合并？** Yes / No / With fixes
```

然后执行：

```bash
gemini --approval-mode yolo -p @/tmp/gemini-review-quality.txt
```

**优先级 3：Self-Review**（Codex 和 Gemini 都不可用时）

退化为 self-review 并明确记录跳过了 cross-agent review。

**通用规则：**

- 根据 review 返回的问题逐一修复
- 修复后**必须**再次运行 review 验证修复
- 循环直到 review 返回无问题，或已达 3 轮上限
- 3 轮后仍有问题则列出剩余问题交由用户决定
- **Review 通过后**，更新 `docs/tasks/plan.md` 中该任务状态为 `reviewed`，并在任务文件、PR body 或执行记录中注明 review 工具、轮数和修复的问题

### 7. 提交并创建 PR

**前置检查（强制）**：读取 `docs/tasks/plan.md`，确认当前任务状态为 `reviewed`，且已有 review 结果记录。如果不是 `reviewed`，**必须先回到步骤 6 完成 review**，禁止跳过。

- commit message 和 PR body 全部使用英文
- commit message 使用 conventional commits：`feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- push 到远程并通过 `gh pr create --base main` 创建 PR
- PR body 格式：

```markdown
## Background
## Approach
## Changes
## Testing
## Code Review
- Review tool: codex / gemini / self-review
- Rounds: N
- Issues fixed: (list issues found and fixed, or "none")
```

### 8. 等待 CI → 合并 → 继续

PR 创建后自动执行：
1. `gh pr checks <PR#> --watch` 等待 CI 通过
2. **CI 失败时禁止合并**：查看失败日志 (`gh run view <run-id> --log-failed`)，修复问题，推送修复 commit，重新等待 CI
3. CI 全部通过后 `gh pr merge <PR#> --squash --delete-branch` 合并
3. 切回 main 并 pull：`git checkout main && git pull`
4. 更新 `docs/tasks/plan.md` 中该任务状态为 `done`，记录 PR 编号
5. 自动继续下一个 `pending` 任务（回到步骤 1）
6. 如果所有任务已完成，汇总所有 PR 列表和最终状态
