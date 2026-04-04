import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../grammy-types';
import { container } from '../../utils';
import { NLPService, CategoryOptions } from '../../../domain/services/nlp.service';
import { ApplicationEventEmitter } from '../../events/event-emitter';
import { EventTypes } from '../../events/event-types';
import { logger } from '../../utils/logger';
import { MESSAGES, CALLBACK_PREFIXES } from '../commands/categorization-constants';

export const CATEGORIZATION_CONVERSATION_ID = 'categorization';

function createCategoryKeyboard(categories: CategoryOptions): InlineKeyboard {
  return new InlineKeyboard()
    .text(`📁 ${categories.primaryCategory}`, 'cat:primary').row()
    .text(`📁 ${categories.alternativeCategory}`, 'cat:alternative').row()
    .text(`📁 ${categories.suggestedNewCategory}`, 'cat:suggested').row()
    .text('❌ Cancel', 'cat:cancel');
}

function createCategoryResultMessage(merchant: string, categories: CategoryOptions): string {
  return (
    `I've analyzed "${merchant}" and found these possible categories:\n\n` +
    `1. ${categories.primaryCategory}\n` +
    `2. ${categories.alternativeCategory}\n` +
    `3. ${categories.suggestedNewCategory}\n\n` +
    `Please select the most appropriate category:`
  );
}

function emitCategorySelected(merchantId: string, merchant: string, selectedCategory: string): void {
  const eventEmitter = container.getByClass(ApplicationEventEmitter);
  eventEmitter.emit(EventTypes.MERCHANT_CATEGORY_SELECTED, {
    merchantId,
    merchant,
    selectedCategory,
    timestamp: new Date().toISOString(),
  });
}

export async function categorizationConversation(
  conversation: Conversation<BotContext>,
  ctx: BotContext,
): Promise<void> {
  // Extract merchantId from callback query data
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery
    ? ctx.callbackQuery.data : undefined;

  if (!callbackData?.startsWith(CALLBACK_PREFIXES.CATEGORIZE_MERCHANT)) {
    return;
  }

  // The callback data format is: CATEGORIZE_MERCHANT + merchantId (full, not truncated).
  // Task 6 wires the notification to use this format and populate session.pendingMerchants.
  const merchantId = callbackData.slice(CALLBACK_PREFIXES.CATEGORIZE_MERCHANT.length);

  // Look up the real merchant name from session data (populated by Task 6)
  const pendingMerchants = ctx.session.pendingMerchants || {};
  const merchantData = pendingMerchants[merchantId];
  const merchant = merchantData?.merchant || merchantId;

  // Remove the "Categorize with AI" button
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    // Message may already have been modified
  }
  await ctx.answerCallbackQuery();

  // Prompt user for additional context
  await ctx.reply(MESSAGES.CATEGORIZATION_PROMPT(merchant), { parse_mode: 'HTML' });

  // Wait for user text input or /cancel
  const contextCtx = await conversation.waitFor(':text');
  const userInput = contextCtx.message?.text;

  if (!userInput || userInput === '/cancel') {
    await contextCtx.reply(MESSAGES.CATEGORIZATION_CANCELLED);
    await conversation.external(() => emitCategorySelected(merchantId, merchant, ''));
    return;
  }

  if (userInput.startsWith('/')) {
    // Other commands: emit cancellation to unblock queue, then pass update through
    await conversation.external(() => emitCategorySelected(merchantId, merchant, ''));
    await conversation.skip({ next: true });
    return;
  }

  // Call NLP to categorize
  await contextCtx.reply(MESSAGES.ANALYZING);

  let categories: CategoryOptions;
  try {
    categories = await conversation.external(() => {
      const nlpService = container.getByClass(NLPService);
      return nlpService.categorizeMerchant(merchant, userInput);
    });
  } catch (error) {
    logger.error('Error categorizing merchant:', error);
    await contextCtx.reply(MESSAGES.CATEGORIZATION_ERROR);
    // Emit cancellation to unblock the queue
    await conversation.external(() => emitCategorySelected(merchantId, merchant, ''));
    return;
  }

  // Show category options
  const keyboard = createCategoryKeyboard(categories);
  await contextCtx.reply(createCategoryResultMessage(merchant, categories), {
    reply_markup: keyboard,
  });

  // Wait for category selection, skip unrelated updates
  const categoryMap: Record<string, string> = {
    'cat:primary': categories.primaryCategory,
    'cat:alternative': categories.alternativeCategory,
    'cat:suggested': categories.suggestedNewCategory,
  };
  const validCallbacks = ['cat:primary', 'cat:alternative', 'cat:suggested', 'cat:cancel'];

  let selectedCategory = '';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const selCtx = await conversation.wait() as BotContext;

    const msgText = selCtx.message && 'text' in selCtx.message ? selCtx.message.text : undefined;
    if (msgText === '/cancel') {
      await selCtx.reply(MESSAGES.CATEGORIZATION_CANCELLED);
      break;
    }

    const cbData = selCtx.callbackQuery && 'data' in selCtx.callbackQuery
      ? selCtx.callbackQuery.data : undefined;

    if (cbData && validCallbacks.includes(cbData)) {
      if (cbData === 'cat:cancel') {
        await selCtx.editMessageText(MESSAGES.CATEGORIZATION_CANCELLED);
      } else {
        selectedCategory = categoryMap[cbData] || '';
        await selCtx.editMessageText(MESSAGES.CATEGORY_SELECTED(merchant, selectedCategory));
      }
      await selCtx.answerCallbackQuery();
      break;
    }

    await conversation.skip({ next: true });
  }

  // Emit event for category selection (or cancellation)
  await conversation.external(() => emitCategorySelected(merchantId, merchant, selectedCategory));

  // Clean up session data
  if (ctx.session.pendingMerchants) {
    delete ctx.session.pendingMerchants[merchantId];
  }
}
