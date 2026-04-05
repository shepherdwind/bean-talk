import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../grammy-types';
import { container } from '../../utils';
import { NLPService } from '../../../domain/services/nlp.service';
import { AccountingService } from '../../../domain/services/accounting.service';
import { Transaction } from '../../../domain/models/transaction';
import { AccountName } from '../../../domain/models/account';
import { Currency } from '../../../domain/models/types';
import { getCashAccount } from '../../utils/telegram';
import { logger } from '../../utils/logger';

export const ADD_BILL_CONVERSATION_ID = 'addBill';

function formatTransaction(transaction: Transaction, status?: string): string {
  return (
    `Transaction Details ${status || ''}\n\n` +
    `Amount: <b>${transaction.entries[1].amount.value} ${transaction.entries[0].amount.currency}</b>\n` +
    `Description: ${transaction.description}\n` +
    `From: ${transaction.entries[0].account}\n` +
    `TO: <b>${transaction.entries[1].account}</b>`
  );
}

interface ConfirmationResult {
  cancelled: boolean;
  action?: string;
  ctx: BotContext;
}

async function waitForConfirmation(
  conversation: Conversation<BotContext, BotContext>,
): Promise<ConfirmationResult> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ctx = await conversation.wait() as BotContext;

    const msgText = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
    if (msgText === '/cancel') {
      await ctx.reply('Operation cancelled.');
      return { cancelled: true, ctx };
    }

    const cbData = ctx.callbackQuery && 'data' in ctx.callbackQuery
      ? ctx.callbackQuery.data : undefined;
    if (cbData === 'add_confirm' || cbData === 'add_cancel') {
      return { cancelled: false, action: cbData, ctx };
    }

    // Skip unrelated updates
    await conversation.skip({ next: true });
  }
}

export async function addBillConversation(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
): Promise<void> {
  await ctx.reply(
    'Please enter your expense information directly, for example:\n\n' +
    '"Spent $50 on food at NTUC"\n' +
    'I will automatically parse and record this transaction.\n\n' +
    'Enter /cancel to cancel the operation.',
  );

  // Wait for user input text
  const inputCtx = await conversation.waitFor(':text');
  const text = inputCtx.message?.text;

  if (!text) {
    await inputCtx.reply('Operation cancelled.');
    return;
  }

  if (text === '/cancel') {
    await inputCtx.reply('Operation cancelled.');
    return;
  }

  if (text.startsWith('/')) {
    // Skip other commands — let them pass through
    await conversation.skip({ next: true });
    return;
  }

  const username = inputCtx.from?.username;
  if (!username) {
    await inputCtx.reply('Unable to identify user. Please ensure your Telegram account has a username set.');
    return;
  }

  const account = getCashAccount(username);
  if (!account) {
    await inputCtx.reply('Sorry, you do not have permission to use this feature.');
    return;
  }

  // Parse expense input via NLP (side effect)
  let transactionData;
  try {
    transactionData = await conversation.external(() => {
      const nlpService = container.getByClass(NLPService);
      return nlpService.parseExpenseInput(text);
    });
  } catch (error) {
    logger.error('Error parsing expense input:', error);
    await inputCtx.reply('Sorry, I cannot process your bill information. Please ensure the format is correct and try again.');
    return;
  }

  const transaction: Transaction = {
    date: new Date(),
    description: transactionData.description,
    entries: [
      {
        account,
        amount: {
          value: -transactionData.amount,
          currency: transactionData.currency as Currency,
        },
      },
      {
        account: transactionData.category as AccountName,
        amount: {
          value: transactionData.amount,
          currency: transactionData.currency as Currency,
        },
      },
    ],
    metadata: { username, message: text },
  };

  const confirmKeyboard = new InlineKeyboard()
    .text('✅ Confirm', 'add_confirm')
    .text('❌ Cancel', 'add_cancel');

  await inputCtx.reply(formatTransaction(transaction), {
    parse_mode: 'HTML',
    reply_markup: confirmKeyboard,
  });

  // Wait for confirm/cancel callback or /cancel command
  const result = await waitForConfirmation(conversation);

  if (result.cancelled) {
    return;
  }

  if (result.action === 'add_confirm') {
    try {
      await conversation.external(() => {
        const accountingService = container.getByClass(AccountingService);
        return accountingService.addTransaction(transaction);
      });
      await result.ctx.editMessageText(
        formatTransaction(transaction, '✅'),
        { parse_mode: 'HTML' },
      );
      await result.ctx.answerCallbackQuery('Transaction saved!');
    } catch (error) {
      logger.error('Error saving transaction:', error);
      await result.ctx.answerCallbackQuery('Error saving transaction, please try again.');
    }
  } else {
    await result.ctx.editMessageText(
      formatTransaction(transaction, '❌'),
      { parse_mode: 'HTML' },
    );
    await result.ctx.answerCallbackQuery('Transaction cancelled.');
  }
}
