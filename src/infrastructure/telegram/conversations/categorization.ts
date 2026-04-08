import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../grammy-types';
import { container } from '../../utils';
import { NLPService } from '../../../domain/services/nlp.service';
import { ApplicationEventEmitter } from '../../events/event-emitter';
import { EventTypes } from '../../events/event-types';
import { logger } from '../../utils/logger';
import { MESSAGES, CALLBACK_PREFIXES } from '../commands/categorization-constants';
import { getPendingMerchant, removePendingMerchant } from '../telegram.adapter';

export const CATEGORIZATION_CONVERSATION_ID = 'categorization';

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
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
): Promise<void> {
  // Extract shortId from callback query data (supports both mi_ and legacy categorize_merchant_)
  const callbackData = ctx.callbackQuery && 'data' in ctx.callbackQuery
    ? ctx.callbackQuery.data : undefined;

  const prefix = callbackData?.startsWith(CALLBACK_PREFIXES.PROVIDE_MORE_INFO)
    ? CALLBACK_PREFIXES.PROVIDE_MORE_INFO
    : callbackData?.startsWith(CALLBACK_PREFIXES.CATEGORIZE_MERCHANT)
      ? CALLBACK_PREFIXES.CATEGORIZE_MERCHANT
      : undefined;

  if (!prefix || !callbackData) {
    return;
  }

  const shortId = callbackData.slice(prefix.length);

  const registryData = await conversation.external(() => getPendingMerchant(shortId));
  if (!registryData) {
    await ctx.answerCallbackQuery(MESSAGES.ERROR_MERCHANT_ID_NOT_FOUND);
    return;
  }
  const { merchantId, merchant } = registryData;

  // Remove buttons from original message
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
    await conversation.external(() => {
      emitCategorySelected(merchantId, merchant, '');
      removePendingMerchant(shortId);
    });
    return;
  }

  if (userInput.startsWith('/')) {
    await conversation.external(() => {
      emitCategorySelected(merchantId, merchant, '');
      removePendingMerchant(shortId);
    });
    await conversation.skip({ next: true });
    return;
  }

  // Call NLP to categorize with additional context
  await contextCtx.reply(MESSAGES.ANALYZING);

  let suggestions: { primary: string; alternative: string };
  try {
    suggestions = await conversation.external(() => {
      const nlpService = container.getByClass(NLPService);
      return nlpService.categorizeMerchantWithContext(merchant, userInput);
    });
  } catch (error) {
    logger.error('Error categorizing merchant:', error);
    await contextCtx.reply(MESSAGES.CATEGORIZATION_ERROR);
    await conversation.external(() => {
      emitCategorySelected(merchantId, merchant, '');
      removePendingMerchant(shortId);
    });
    return;
  }

  if (!suggestions.primary && !suggestions.alternative) {
    await contextCtx.reply(MESSAGES.CATEGORIZATION_ERROR);
    await conversation.external(() => {
      emitCategorySelected(merchantId, merchant, '');
      removePendingMerchant(shortId);
    });
    return;
  }

  // Show 2 category options
  const keyboard = new InlineKeyboard()
    .text(`📁 ${suggestions.primary}`, 'cat:primary').row()
    .text(`📁 ${suggestions.alternative}`, 'cat:alternative').row()
    .text('❌ Cancel', 'cat:cancel');

  await contextCtx.reply(
    `Based on your input, here are the suggested categories for "${merchant}":\n\n` +
    `1. ${suggestions.primary}\n` +
    `2. ${suggestions.alternative}\n\n` +
    `Please select a category:`,
    { reply_markup: keyboard },
  );

  // Wait for category selection
  const categoryMap: Record<string, string> = {
    'cat:primary': suggestions.primary,
    'cat:alternative': suggestions.alternative,
  };
  const validCallbacks = ['cat:primary', 'cat:alternative', 'cat:cancel'];

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

  // Clean up
  await conversation.external(() => removePendingMerchant(shortId));
}
