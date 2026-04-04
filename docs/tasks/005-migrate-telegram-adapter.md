# Task 005: Migrate TelegramAdapter and remove Telegraf

## Goal

Rewire `TelegramAdapter` to use grammY Bot. Remove `CommandHandlers` class entirely — its routing logic is replaced by grammY's middleware chain + conversations. Remove `telegraf` npm dependency.

## Files to modify

- `src/infrastructure/telegram/telegram.adapter.ts`
  - Import and use grammY Bot from `bot.ts` (Task 001)
  - Register all conversations (`addBill`, `categorization`) via `createConversation()`
  - Register command handlers (`/start`, `/add`, `/query`, `/cancel`)
  - Register callback query handlers (query time ranges, categorize merchant entry)
  - Register text message handler for custom query (`查` prefix)
  - Keep `sendNotification()` method using `bot.api.sendMessage()`
  - Keep graceful shutdown via `bot.stop()`
- `src/infrastructure/telegram/command-handlers.ts` — **delete**
- `src/infrastructure/telegram/commands/base-command-handler.ts` — **delete** (no longer needed; handlers are plain functions or thin wrappers)
- `src/infrastructure/telegram/commands/add-command-handler.ts` — simplify to entry point that calls `ctx.conversation.enter("addBill")`
- `src/infrastructure/telegram/commands/categorization-command-handler.ts` — **delete** (replaced by conversation)
- `src/infrastructure/telegram/commands/categorization-utils.ts` — **delete**
- `src/infrastructure/telegram/commands/categorization-types.ts` — **delete**
- `src/app-initializer.ts` — update TelegramAdapter construction/registration
- `package.json` — remove `telegraf`, ensure `grammy` and `@grammyjs/conversations` are present

## Inputs

- grammY Bot instance from Task 001
- Migrated query handlers from Task 002
- Conversation functions from Tasks 003 and 004

## Outputs

- Single unified TelegramAdapter using grammY
- No `CommandHandlers` class, no `UserState` Map, no `transactionData` Map
- Clean middleware chain with deterministic ordering

## Acceptance criteria

- 先编写 TelegramAdapter 集成测试（命令注册、conversation 注册、middleware 链），再实现
- No `telegraf` import anywhere in codebase
- `npm ls telegraf` shows not installed
- `UserState` Map eliminated
- `transactionData` Map eliminated
- Bot launches, all commands work: `/start`, `/add`, `/query`, `/cancel`
- All conversations work: add-bill, categorization
- `npm test` 全部通过

## Dependencies

- Task 002, Task 003, Task 004
