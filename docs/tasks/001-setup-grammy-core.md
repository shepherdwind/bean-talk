# Task 001: Set up grammY core with session middleware

## Goal

Replace Telegraf with grammY Bot, configure session (file-based persistent store) and conversations plugin. This is the foundation for all subsequent tasks.

## Files to create/modify

- `package.json` — replace `telegraf` with `grammy`, `@grammyjs/conversations`
- `src/infrastructure/telegram/types.ts` — define `SessionData`, custom `BotContext` extending grammY `Context` with session and conversation properties
- `src/infrastructure/telegram/bot.ts` (new) — create and export configured Bot instance with:
  - File-based session middleware (JSON persistence under `BEANCOUNT_FILE_PATH` or a dedicated path)
  - Conversations plugin registered
  - Chat whitelist middleware (port from current `CommandHandlers` logic)

## Inputs

- Current Telegraf setup in `telegram.adapter.ts` and `command-handlers.ts`
- grammY docs: https://grammy.dev/guide/getting-started
- @grammyjs/conversations docs: https://grammy.dev/plugins/conversations

## Outputs

- A working grammY Bot instance that can start, respond to `/start`, and persist session data across restarts
- `BotContext` type usable by all subsequent tasks

## Acceptance criteria

- 先编写 Bot 初始化、session 持久化、conversation 注册的测试，再实现
- Bot can start and respond to `/start`
- `ctx.session` is available and persists to disk (file-based JSON)
- Conversations plugin is registered and `ctx.conversation` is available
- Old Telegraf types are not imported in any new files
- `npm test` 全部通过

## Dependencies

None — this is the first task.
