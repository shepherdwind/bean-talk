# Task 004: Rewrite categorization flow as grammY conversation

## Goal

Replace the three-Map + circular-dependency pattern with a `categorizationConversation` function. This is the most complex handler in the codebase.

## Current flow (problematic)

1. Event system sends notification with "Categorize with AI" button
2. User clicks → `handleCallbackQuery()` extracts merchantId via `truncatedIdMap`, looks up `pendingCategorizations`, prompts for context
3. User types context → `handleMessage()` scans `pendingCategorizations` by chatId, calls NLP, stores result in `categorizationMap`, shows category buttons
4. User selects category → emits `MERCHANT_CATEGORY_SELECTED` event

State spread across: `pendingCategorizations` Map, `truncatedIdMap` Map, `categorizationMap` Map, `CommandHandlers.userStates` Map, plus circular dependency between `CategorizationCommandHandler` ↔ `CommandHandlers`.

## Target flow

Notification is sent outside the conversation (by event system via `bot.api.sendMessage()`). User clicks "Categorize with AI" → `bot.callbackQuery()` enters the conversation:

```typescript
// Entry point (registered in TelegramAdapter):
// bot.callbackQuery(/^categorize_merchant_/, ctx => ctx.conversation.enter("categorization"))

async function categorizationConversation(conversation: Conversation<BotContext>, ctx: BotContext) {
  const merchantId = extractMerchantId(ctx.callbackQuery.data);
  const merchantData = await conversation.external(() => lookupMerchantData(merchantId));

  await ctx.reply("Please provide context for categorization...");
  const contextMsg = await conversation.wait();  // wait for text

  const categories = await conversation.external(() =>
    nlpService.categorizeMerchant(merchantData, contextMsg.message.text)
  );

  await ctx.reply(formatCategoryOptions(categories), { reply_markup: categoryKeyboard });
  const selection = await conversation.wait();  // wait for category button

  await conversation.external(() =>
    eventEmitter.emit(EventTypes.MERCHANT_CATEGORY_SELECTED, { merchantId, category: selectedCategory })
  );
}
```

## Files to create/modify

- `src/infrastructure/telegram/conversations/categorization.ts` (new) — conversation function
- Files to eventually remove (in Task 5): `categorization-command-handler.ts`, `categorization-utils.ts`, `categorization-types.ts`

## Inputs

- `BotContext` type from Task 001
- Current categorization logic (NLP call, event emission, category formatting)
- `NLPService`, `ApplicationEventEmitter` from DI container
- `categorization-constants.ts` (keep — contains reusable constants)

## Outputs

- Complete categorization flow in a single conversation function
- No Maps for pendingCategorizations, truncatedIdMap, categorizationMap
- No circular dependency

## Acceptance criteria

- 先编写 categorization conversation 的测试（happy path + cancel），再实现
- Categorization flow works: click → enter context → select category → done
- No separate Maps
- No circular dependency with CommandHandlers
- Side effects wrapped in `conversation.external()`
- Queue advancement via event after selection
- `npm test` 全部通过

## Dependencies

- Task 001
