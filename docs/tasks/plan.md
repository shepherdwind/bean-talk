# Development Plan: Migrate Telegram Bot from Telegraf to grammY + Conversations

## Goal

Replace Telegraf with grammY and @grammyjs/conversations to fix lifecycle/state management chaos.

## Tasks

| # | Task | Status | Depends On | File |
|---|------|--------|------------|------|
| 0 | Fix broken tests and establish test baseline | done (PR #1) | — | [000](000-test-baseline.md) |
| 1 | Set up grammY core with session middleware | done (PR #2) | 0 | [001](001-setup-grammy-core.md) |
| 2 | Migrate query commands (stateless) | done (PR #3) | 1 | [002](002-migrate-query-commands.md) |
| 3 | Rewrite add-bill flow as grammY conversation | done (PR #4) | 1 | [003](003-rewrite-add-bill-conversation.md) |
| 4 | Rewrite categorization flow as grammY conversation | done (PR #5) | 1 | [004](004-rewrite-categorization-conversation.md) |
| 5 | Migrate TelegramAdapter and remove Telegraf | done (PR #6) | 2, 3, 4 | [005](005-migrate-telegram-adapter.md) |
| 6 | Wire event-driven categorization entry | done (PR #7) | 4, 5 | [006](006-wire-event-driven-categorization.md) |

## Dependency Graph

```
0 (test baseline)
└── 1 (grammY core + session)
    ├── 2 (query commands)
    ├── 3 (add-bill conversation)
    └── 4 (categorization conversation)
        All of 2, 3, 4 ──► 5 (remove Telegraf)
                            └── 6 (event-driven entry)
```

## Testing Strategy

每个任务采用 TDD 流程：先写测试 → 实现 → 测试通过。

1. **Task 0**: 修复现有断裂测试，补充 domain/infrastructure 层基线测试，确保 `npm test` 全部通过
2. **Task 1-6**: 每个任务先编写该任务涉及功能的测试用例，再实现，完成后 `npm test` 全部通过
3. 测试不依赖外部服务（OpenAI、Gmail、Telegram）——通过 mock adapter 隔离
