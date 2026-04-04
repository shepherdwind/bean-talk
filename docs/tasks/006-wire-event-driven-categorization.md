# Task 006: Wire event-driven categorization entry

## Goal

Connect `EventListenerService` → `MessageQueueService` → categorization conversation entry. The notification is sent as a plain message; the conversation starts when the user clicks "Categorize with AI".

## Key challenge

grammY conversations are entered via `ctx.conversation.enter()` which requires a user-initiated context. For event-driven entry (email arrives via cron), we send a notification first, then the user's button click provides the context to enter the conversation.

## Approach

1. `EventListenerService` receives `MERCHANT_NEEDS_CATEGORIZATION` event
2. `MessageQueueService` enqueues the notification
3. Queue processes → sends notification via `bot.api.sendMessage()` with "Categorize with AI" inline button (callback data includes merchantId)
4. `bot.callbackQuery(/^categorize_merchant_/)` handler (registered in TelegramAdapter) calls `ctx.conversation.enter("categorization")`
5. Conversation completes → emits `MERCHANT_CATEGORY_SELECTED` → `MessageQueueService.completeTask()`

## Files to modify

- `src/infrastructure/events/event-listener.service.ts` — use `bot.api.sendMessage()` instead of `telegramAdapter.sendNotification()`
- `src/infrastructure/events/message-queue.service.ts` — add timeout/expiry logic so queue doesn't block permanently if user ignores notification
- `src/infrastructure/telegram/telegram.adapter.ts` — ensure `sendNotification()` sends plain message with inline keyboard (no state mutation); expose bot instance or API for event system

## Inputs

- Categorization conversation from Task 004
- TelegramAdapter from Task 005
- Current `MessageQueueService` and `EventListenerService`

## Outputs

- End-to-end flow: email event → notification → user click → conversation → category selected → queue advances
- Queue has timeout mechanism

## Acceptance criteria

- 先编写 event → notification → conversation entry 的集成测试，再实现
- Email event → notification sent → user clicks → enters categorization conversation
- Queue advances after conversation completes or times out
- No state leaks if user ignores the notification
- Multiple pending categorizations are queued and processed sequentially
- `npm test` 全部通过

## Dependencies

- Task 004, Task 005
