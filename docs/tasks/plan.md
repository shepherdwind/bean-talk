# Development Plan

## Phase 1: Migrate Telegram Bot from Telegraf to grammY + Conversations (done)

### Goal

Replace Telegraf with grammY and @grammyjs/conversations to fix lifecycle/state management chaos.

### Tasks

| # | Task | Status | Depends On | File |
|---|------|--------|------------|------|
| 0 | Fix broken tests and establish test baseline | done (PR #1) | — | [000](000-test-baseline.md) |
| 1 | Set up grammY core with session middleware | done (PR #2) | 0 | [001](001-setup-grammy-core.md) |
| 2 | Migrate query commands (stateless) | done (PR #3) | 1 | [002](002-migrate-query-commands.md) |
| 3 | Rewrite add-bill flow as grammY conversation | done (PR #4) | 1 | [003](003-rewrite-add-bill-conversation.md) |
| 4 | Rewrite categorization flow as grammY conversation | done (PR #5) | 1 | [004](004-rewrite-categorization-conversation.md) |
| 5 | Migrate TelegramAdapter and remove Telegraf | done (PR #6) | 2, 3, 4 | [005](005-migrate-telegram-adapter.md) |
| 6 | Wire event-driven categorization entry | done (PR #7) | 4, 5 | [006](006-wire-event-driven-categorization.md) |

---

## Phase 2: Achieve 90% Test Coverage

### Goal

Raise test coverage from 46.92% to 90%+ across the entire repository by adding unit tests for all untested or undertested modules. All tests mock external dependencies (OpenAI, Gmail, Telegram, filesystem).

### Tasks

| # | Task | Status | Depends On | File |
|---|------|--------|------------|------|
| 7 | Domain & application layer test coverage | done (PR #9) | — | [007](007-domain-app-test-coverage.md) |
| 8 | Infrastructure utilities & events test coverage | reviewed | — | [008](008-infra-utils-events-test-coverage.md) |
| 9 | Infrastructure adapters test coverage | pending | — | [009](009-infra-adapters-test-coverage.md) |

### Dependency Graph

```
7 (domain & app layer)  ─┐
8 (utils & events)       ├── all independent, can run in parallel
9 (infra adapters)       ─┘
```

### Testing Strategy

1. All tests mock external dependencies (OpenAI, Gmail API, Telegram Bot, filesystem, shell commands)
2. Use constructor injection for testable dependencies
3. Focus on branch coverage to hit the 90% target — test error paths and edge cases
4. Each task targets specific modules and should bring the overall coverage above 90% when combined
