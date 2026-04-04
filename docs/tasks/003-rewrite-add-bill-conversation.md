# Task 003: Rewrite add-bill flow as grammY conversation

## Goal

Replace the Map-based state + callback_query pattern with a single `addBillConversation` function using @grammyjs/conversations.

## Current flow (problematic)

1. `/add` → `CommandHandlers` sets `UserState.ADDING_BILL`
2. Next text message → routed to `addHandler.handleMessage()` → `processBillInput()`
3. `processBillInput()` calls `NLPService.parseExpenseInput()`, stores result in `CommandHandlers.transactionData` Map, sends confirm/cancel inline buttons
4. User taps button → `handleCallbackQuery()` confirms or cancels
5. **Bug**: Neither branch resets `UserState` back to `IDLE` — user stays in `ADDING_BILL` forever

## Target flow (single async function)

```typescript
async function addBillConversation(conversation: Conversation<BotContext>, ctx: BotContext) {
  await ctx.reply("Please enter bill details...");
  const input = await conversation.wait();  // wait for text
  const transaction = await conversation.external(() => nlpService.parseExpenseInput(input.message.text));
  await ctx.reply(formatConfirmation(transaction), { reply_markup: confirmKeyboard });
  const selection = await conversation.wait();  // wait for callback
  if (selection.callbackQuery?.data === "add_confirm") {
    await conversation.external(() => accountingService.addTransaction(transaction));
  }
  // conversation ends naturally — no state to clean up
}
```

## Files to create/modify

- `src/infrastructure/telegram/conversations/add-bill.ts` (new) — conversation function
- `src/infrastructure/telegram/commands/add-command-handler.ts` — remove state management logic, keep as thin entry point that calls `ctx.conversation.enter("addBill")`

## Inputs

- `BotContext` type from Task 001
- Current `AddCommandHandler` logic for NLP parsing and confirmation formatting
- `NLPService` and `AccountingService` from DI container

## Outputs

- Complete add-bill flow in a single conversation function
- No Maps for state or transactionData

## Acceptance criteria

- 先编写 add-bill conversation 的测试（happy path + cancel + 异常输入），再实现
- Full add-bill flow works: `/add` → enter text → confirm/cancel → done
- No separate Maps for state/transactionData
- Conversation auto-cleans up on completion, cancellation, or `/cancel`
- Side effects (NLP call, save transaction) wrapped in `conversation.external()`
- `npm test` 全部通过

## Dependencies

- Task 001
