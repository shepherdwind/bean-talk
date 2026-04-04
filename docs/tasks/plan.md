# Development Plan: Migrate Telegram Bot from Telegraf to grammY + Conversations

## Goal

Replace Telegraf with grammY and @grammyjs/conversations to fix lifecycle/state management chaos. Current pain points:

- State split across 5 Maps in 2 classes with circular dependencies
- Multiple `callback_query` listeners with implicit ordering
- UserState not reset after button-driven flows (bug)
- Message queue blocks permanently if user ignores a prompt
- Tests broken and out of sync with production code
- No state persistence — process restart loses all in-flight conversations

## Tasks

| # | Task | Status | Depends On |
|---|------|--------|------------|
| 1 | Set up grammY core with session middleware | pending | — |
| 2 | Migrate query commands (stateless) | pending | 1 |
| 3 | Rewrite add-bill flow as grammY conversation | pending | 1 |
| 4 | Rewrite categorization flow as grammY conversation | pending | 1 |
| 5 | Migrate TelegramAdapter and remove Telegraf | pending | 2, 3, 4 |
| 6 | Wire event-driven categorization entry | pending | 4, 5 |
| 7 | Update tests | pending | 2, 3, 4, 5, 6 |

## Dependency Graph

```
1 (grammY core + session + persistent store)
├── 2 (query commands — stateless)
├── 3 (add-bill conversation)
└── 4 (categorization conversation)
    All of 2, 3, 4 ──► 5 (adapter migration, remove Telegraf)
                        └── 6 (wire event-driven categorization entry)
                             └── 7 (tests)
```

## Task Details

### Task 1: Set up grammY core with session middleware

**Goal**: Replace Telegraf with grammY Bot, configure session and conversations plugin.

**Files to create/modify**:
- `package.json` — replace `telegraf` with `grammy`, `@grammyjs/conversations`
- `src/infrastructure/telegram/types.ts` — define `SessionData`, custom `BotContext` extending grammY Context with session and conversation
- `src/infrastructure/telegram/bot.ts` (new) — create and export configured Bot instance with session middleware (file-based persistent store) and conversations plugin

**Acceptance criteria**:
- Bot can start, respond to `/start`, and use `ctx.session`
- Session middleware uses a persistent storage backend (file-based JSON) so in-flight conversations survive process restarts
- Conversations plugin is registered
- Old Telegraf types no longer imported anywhere new

### Task 2: Migrate query commands (stateless)

**Goal**: Port `QueryCommandHandler` and `CustomQueryCommandHandler` to grammY. These are stateless — no conversation needed.

**Files to modify**:
- `src/infrastructure/telegram/commands/query-command-handler.ts` — use grammY `bot.command()` and `bot.callbackQuery()`
- `src/infrastructure/telegram/commands/custom-query-command-handler.ts` — use grammY `bot.on("message:text")`

**Acceptance criteria**:
- `/query` shows time range keyboard, callback selects range and returns results
- Free-text starting with `查` triggers custom query
- No Telegraf imports remain in these files
- Replace `console.error` with logger

### Task 3: Rewrite add-bill flow as grammY conversation

**Goal**: Replace the Map-based state + callback_query pattern with a single `addBillConversation` function using @grammyjs/conversations.

**Current flow**: `/add` → set ADDING_BILL → wait for text → parse → show confirm/cancel buttons → wait for callback → commit or discard. Bug: UserState not reset after callback.

**Target flow** (single async function):
```
async function addBillConversation(conversation, ctx) {
  await ctx.reply("Please enter bill...");
  const input = await conversation.wait();  // wait for text
  const transaction = await conversation.external(() => nlpService.parse(input));
  await ctx.reply(confirmation, { reply_markup: keyboard });
  const selection = await conversation.wait();  // wait for callback
  if (confirmed) await conversation.external(() => save(transaction));
}
```

**Files to modify/create**:
- `src/infrastructure/telegram/conversations/add-bill.ts` (new)
- Remove `add-command-handler.ts` state logic

**Acceptance criteria**:
- Full add-bill flow works end-to-end in a single conversation function
- No separate Maps for state/transactionData
- Conversation auto-cleans up on completion or `/cancel`

### Task 4: Rewrite categorization flow as grammY conversation

**Goal**: Replace the three-Map + circular-dependency pattern with a `categorizationConversation` function.

**Current flow**: Event → notification with button → user clicks → prompt for context → NLP categorize → show category buttons → user selects → emit event. State in 3 Maps + UserState + circular dep on CommandHandlers.

**Target flow**: Notification is sent outside the conversation (by event system). User clicks "Categorize with AI" → `bot.callbackQuery()` enters the conversation. The conversation itself only handles the interactive steps:

```
// Entry: bot.callbackQuery("categorize_merchant_*", ctx => ctx.conversation.enter("categorization"))

async function categorizationConversation(conversation, ctx) {
  // ctx already has the callback query data with merchantId
  const merchantData = extractMerchantData(ctx);
  await ctx.reply("Enter context...");
  const context = await conversation.wait();  // wait for text
  const categories = await conversation.external(() => nlpService.categorize(...));
  await ctx.reply(options, { reply_markup: categoryKeyboard });
  const selection = await conversation.wait();  // wait for category selection
  await conversation.external(() => emitCategorySelected(...));
}
```

**Files to modify/create**:
- `src/infrastructure/telegram/conversations/categorization.ts` (new)
- Remove `categorization-command-handler.ts` state logic, `categorization-utils.ts`, `categorization-types.ts`

**Acceptance criteria**:
- Full categorization flow works in a single conversation function
- No separate Maps (pendingCategorizations, truncatedIdMap, categorizationMap)
- No circular dependency with CommandHandlers
- Queue advancement via event after selection

### Task 5: Migrate TelegramAdapter and remove Telegraf

**Goal**: Rewire `TelegramAdapter` to use grammY Bot. Remove `CommandHandlers` class (its routing logic is replaced by grammY middleware + conversations). Remove Telegraf dependency.

**Files to modify**:
- `src/infrastructure/telegram/telegram.adapter.ts` — use grammY Bot, register conversations and command handlers
- `src/infrastructure/telegram/command-handlers.ts` — delete (replaced by grammY middleware chain)
- `src/infrastructure/telegram/commands/base-command-handler.ts` — delete or simplify
- `src/app-initializer.ts` — update TelegramAdapter construction
- `package.json` — remove `telegraf` dependency

**Acceptance criteria**:
- No `telegraf` import anywhere in codebase
- `UserState` Map eliminated (conversations own their state)
- `transactionData` Map eliminated
- Bot launches, all commands and conversations work

### Task 6: Fix event-driven categorization entry with conversations

**Goal**: Wire `EventListenerService` → `MessageQueueService` → conversation entry. Currently `sendNotification()` on TelegramAdapter triggers categorization — this needs to enter a grammY conversation programmatically.

**Key challenge**: grammY conversations are normally entered via `ctx.conversation.enter()` (user-initiated). For event-driven entry (email arrives), we need to send a message first, then the conversation starts when the user interacts.

**Approach**: Keep the notification push as a plain message with inline keyboard. The callback from "Categorize with AI" button enters the conversation via `bot.callbackQuery()` → `ctx.conversation.enter("categorization")`.

**Files to modify**:
- `src/infrastructure/events/event-listener.service.ts` — adjust to send notification via bot directly
- `src/infrastructure/events/message-queue.service.ts` — simplify, add timeout/expiry logic
- `src/infrastructure/telegram/telegram.adapter.ts` — expose method to send notification and register callback entry point

**Acceptance criteria**:
- Email event → notification sent → user clicks → enters conversation
- Queue advances after conversation completes or times out
- No state leaks if user ignores the notification

### Task 7: Update tests

**Goal**: Fix all broken tests and add coverage for conversation flows.

**Files to modify/create**:
- `src/infrastructure/telegram/commands/__tests__/` — rewrite for grammY API
- `src/infrastructure/telegram/conversations/__tests__/` (new) — test conversation flows

**Acceptance criteria**:
- All tests pass (`npm test`)
- Conversation flows have test coverage for happy path + cancel + timeout
- No references to Telegraf API in test code
