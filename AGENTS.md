<!-- GENERATED FILE. DO NOT EDIT DIRECTLY. -->
<!-- Source: agent-standards/templates/AGENTS.base.md -->

# 仓库级 Agent 说明

本仓库使用分层规范：
- `AGENTS.md`：工作流、review 流程、执行约束
- `.claude/rules.md`：编码规则
- `.claude/skills/*`：流程入口和操作编排

适用范围：
- 本文件适用于整个仓库
- 编码规范在 `.claude/rules.md`

## 编码规则入口

所有代码实现、重构、测试和 review，先遵循 `.claude/rules.md`，再遵循本文件中的流程约束。

## Cross-Agent Review

默认优先使用外部 agent review，而不是 self-review。

优先级：
1. Codex
2. Gemini CLI
3. Self-review

### Priority 1: Codex

- 如果当前执行者是 Claude，优先调用 Codex CLI review
- 未提交变更：`codex review --uncommitted`
- 对比 `main` 分支：`codex review --base main`
- 单个 commit：`codex review --commit <sha>`
- `--uncommitted`、`--base`、`--commit` 和 `[PROMPT]` 互斥，不要混用
- Codex review 可能较慢，必须等待完整结果，不要提前超时退出

### Priority 2: Gemini CLI

- 当 Codex 不可用时，使用 `gemini --approval-mode yolo -p "<prompt>"`
- 运行两轮：
1. spec 合规检查：传入 task 文件内容和 `AGENTS.md`，逐条核对实现与规范
2. 代码质量检查：传入 `git diff --stat main...HEAD` 和 `AGENTS.md`，检查质量、架构、测试和可合并性

### Priority 3: Self-review

- 当 Codex 和 Gemini 都不可用时，退化为 self-review，并明确记录已跳过 cross-agent review

### 通用规则

- 最多进行 3 轮 review 修复闭环
- 每轮修复后都要重新验证
- 若对端 agent 不可用，降级到下一个优先级

## 工作流映射

### `dev`

用于执行计划内任务或单个功能/修复。

1. 读取 `docs/tasks/plan.md`，确定当前任务
2. 若存在状态为 `pr_created` 的前序任务，先检查其 PR 是否已合并
3. 阅读对应 task 文件、相关代码和 `docs/` 文档
4. 明确需要修改的文件和实现步骤
5. 非 trivial 任务在实现前先向用户确认计划
6. 分步实现，并持续对照本文件自检
7. 为核心逻辑补充或更新测试
8. 在 review 前、commit 前运行 `npm test`，且必须全部通过
9. 完成 cross-agent review 后，才能把任务状态更新为 `reviewed`
10. 记录 review tool、轮数和修复的问题，写入 task 文件、PR body 或执行记录
11. 若任务包含 git/PR 流程，commit message 和 PR body 使用英文 conventional commit 风格
12. 及时更新 `docs/tasks/plan.md` 中的任务状态和 PR 链接

PR body 至少包含：

```md
## Background
## Approach
## Changes
## Testing
```

### `dev-master`

用于按照依赖顺序批量调度多个任务，由子 agent 执行 `/dev` 流程。

1. 读取 `docs/tasks/plan.md`，找出待执行任务及依赖
2. 按依赖顺序派发子 agent
3. 给每个子 agent 提供 task 文件全文、`AGENTS.md`、相关设计文档章节和前置任务产出
4. 子 agent 完成后，验证 PR、等待 CI、合并并更新状态
5. 对 `BLOCKED` / `NEEDS_CONTEXT` 情况补充上下文或升级处理
6. 全部完成后输出汇总结果

主 agent 只做协调，不直接写实现代码。

### `dev-plan`

用于把较大目标拆成可执行任务。

1. 阅读相关文档和现有代码
2. 将目标拆分成可独立交付的任务，写清输入、输出、验收标准和依赖
3. 将总计划写入 `docs/tasks/plan.md`
4. 对任务拆分执行 cross-agent review
5. 计划确认后，在 `docs/tasks/` 下创建详细任务文件
6. `docs/tasks/plan.md` 允许的状态值为：
   - `pending`
   - `in_progress`
   - `reviewed`
   - `pr_created`
   - `done`
   - `failed`

## Codex 执行约束

- 非 trivial 任务在修改前，先读 task 文件、`docs/tasks/plan.md` 和相关设计文档
- 默认把 `docs/technical-design.md` 视为架构真源，除非用户明确覆盖
- 非 trivial 实现前先给出简短计划
- 修改应聚焦当前任务，不顺手做无关重构
- 编辑前先确认目标文件是否已有用户改动，避免覆盖无关变更
- 涉及任务流转时，保持 `docs/tasks/plan.md` 状态准确
- 先做最窄验证，再做更宽验证
- 若测试或 review 无法完成，要明确说明缺口和原因
- 若本文件与通用 agent 偏好冲突，以本文件为准
- 实现有状态模块时，显式建模状态、动作和迁移，不要把流程写成零散条件分支

## Task 文件要求

- task 文件保持简洁、面向实现
- 每个 task 文件至少包含：
  - Goal
  - Files or modules involved
  - Inputs, outputs, and acceptance criteria
  - Dependency task IDs

## 事实来源

- 架构和模块边界：`docs/technical-design.md`
- 产品意图：`docs/product-design.md`
- 执行顺序和任务状态：`docs/tasks/plan.md` 及 `docs/tasks/` 下文件
- 测试流程：`docs/test-plan.md`
- 设计上下文与视觉规范：`.impeccable.md`

## 设计上下文

- 品牌：Professional, Precise, Reliable。整体感受应是克制、可信、让用户感觉可控
- 参考：Linear 风格，极简、快速、暗色优先；避免浮夸动画和传统 ERP 质感
- 原则：Data first、quiet confidence、consistent tokens、responsive feedback、dark mode parity
- 主题：只使用 `theme.useToken()`，不要写死颜色；深色和浅色都必须是一等公民
- 完整设计规范见 `.impeccable.md`
