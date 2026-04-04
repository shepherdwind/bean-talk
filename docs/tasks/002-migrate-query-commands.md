# Task 002: Migrate query commands (stateless)

## Goal

Port `QueryCommandHandler` and `CustomQueryCommandHandler` to grammY API. These are stateless — no conversation needed, making them a low-risk migration target.

## Files to modify

- `src/infrastructure/telegram/commands/query-command-handler.ts`
  - Replace Telegraf `bot.action()` with grammY `bot.callbackQuery()`
  - Replace Telegraf context types with `BotContext`
  - Replace `console.error` with logger (lines 44, 106)
- `src/infrastructure/telegram/commands/custom-query-command-handler.ts`
  - Replace Telegraf `bot.on("message")` with grammY `bot.on("message:text")`
  - Replace Telegraf context types with `BotContext`

## Inputs

- `BotContext` type from Task 001
- Current handler implementations
- grammY filter queries: https://grammy.dev/guide/filter-queries

## Outputs

- Both handlers work with grammY Bot instance
- No Telegraf imports in these files

## Acceptance criteria

- 先编写 query 命令和 custom query 的测试用例，再迁移实现
- `/query` shows time range keyboard, callback selects range and returns results
- Free-text starting with `查` triggers custom query
- No Telegraf imports remain in these files
- `console.error` replaced with logger
- `npm test` 全部通过

## Dependencies

- Task 001
