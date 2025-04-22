import { Context } from 'telegraf';
import { CallbackQuery } from 'telegraf/typings/core/types/typegram';
import { BaseCommandHandler } from './base-command-handler';
import { AccountingService } from '../../../domain/services/accounting.service';
import { container } from '../../utils';
import { Transaction } from '../../../domain/models/transaction';
import { AccountName } from '../../../domain/models/account';
import { Currency } from '../../../domain/models/types';
import { Telegraf } from 'telegraf';
import { CommandHandlers, UserState } from '../command-handlers';
import { getCashAccount } from '../../utils/telegram';
import { NLPService } from '../../../domain/services/nlp.service';

export class AddCommandHandler extends BaseCommandHandler {
  private accountingService: AccountingService;
  private nlpService: NLPService;
  private bot: Telegraf;
  private commandHandlers: CommandHandlers;

  constructor(bot: Telegraf, commandHandlers: CommandHandlers) {
    super();
    this.bot = bot;
    this.commandHandlers = commandHandlers;
    this.accountingService = container.getByClass(AccountingService);
    this.nlpService = container.getByClass(NLPService);

    // Set up callback query handler
    this.bot.on('callback_query', async (ctx, next) => {
      const handled = await this.handleCallbackQuery(ctx);
      if (!handled) {
        return next();
      }
    });
  }

  async handle(ctx: Context, ...args: any[]): Promise<void> {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) {
      await ctx.reply('Error: Could not identify chat ID');
      return;
    }

    // Set user state to adding bill
    this.commandHandlers.setUserState(chatId, UserState.ADDING_BILL);

    await ctx.reply(
      'Please enter your expense information directly, for example:\n\n' +
      '"Spent $50 on food at NTUC"\n' +
      'I will automatically parse and record this transaction.\n\n' +
      'Enter /cancel to cancel the operation.'
    );
  }

  // Handle user messages, called by CommandHandlers
  async handleMessage(ctx: Context): Promise<boolean> {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) {
      return false; // Don't process this message
    }

    // Check if user is in adding bill state or idle state
    const userState = this.commandHandlers.getUserState(chatId);
    if (userState !== UserState.ADDING_BILL && userState !== UserState.IDLE) {
      return false; // Don't process this message
    }

    if (!ctx.message || !('text' in ctx.message)) {
      return false;
    }

    const text = ctx.message.text;
    if (text.startsWith('/')) {
      if (text === '/cancel') {
        this.commandHandlers.resetUserState(chatId);
        await ctx.reply('Operation cancelled.');
        return true; // Message handled
      }
      return false; // Don't process other commands
    }

    try {
      // If user is in IDLE state, set it to ADDING_BILL
      if (userState === UserState.IDLE) {
        this.commandHandlers.setUserState(chatId, UserState.ADDING_BILL);
      }
      
      await this.processBillInput(ctx, text);
      return true; // Message handled
    } catch (error) {
      this.logger.error('Error processing bill input:', error);
      await ctx.reply('Sorry, there was an error processing your bill information. Please try again.');
      return true; // Message handled
    }
  }

  private generateTransactionMessage(transaction: Transaction, status?: string): string {
    return (
      `Transaction Details ${status || ''}\n\n` +
      `Amount: <b>${transaction.entries[0].amount.value} ${transaction.entries[0].amount.currency}</b>\n` +
      `Description: ${transaction.description}\n` +
      `Account: ${transaction.entries[0].account}\n` +
      `Category: <b>${transaction.entries[1].account}</b>`
    );
  }

  private async processBillInput(ctx: Context, input: string): Promise<void> {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    try {
      // await ctx.reply('Processing your bill information...');

      // Get the username from the message
      const username = ctx.from?.username;
      if (!username) {
        await ctx.reply('Unable to identify user. Please ensure your Telegram account has a username set.');
        return;
      }

      // Determine which account to use based on username
      const account = getCashAccount(username);
      if (!account) {
        await ctx.reply('Sorry, you do not have permission to use this feature.');
        return;
      }

      // Use NLP service to parse the input and create a transaction
      const transactionData = await this.nlpService.parseExpenseInput(input);

      // Create transaction object
      const transaction: Transaction = {
        date: new Date(),
        description: transactionData.description,
        entries: [
          {
            account: account,
            amount: {
              value: transactionData.amount,
              currency: transactionData.currency as Currency
            }
          },
          {
            account: transactionData.category as AccountName,
            amount: {
              value: -transactionData.amount,
              currency: transactionData.currency as Currency
            }
          }
        ],
        metadata: {
          username,
          message: input,
        }
      };

      // Send confirmation message with buttons
      const message = this.generateTransactionMessage(transaction);

      // Store transaction data in user state for later use
      this.commandHandlers.setTransactionData(chatId, transaction);

      // Send confirmation buttons
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Confirm', callback_data: 'add_confirm' },
              { text: '❌ Cancel', callback_data: 'add_cancel' }
            ]
          ]
        }
      });
    } catch (error) {
      this.logger.error('Error processing bill:', error);
      await ctx.reply('Sorry, I cannot process your bill information. Please ensure the format is correct and try again.');
    }
  }

  // Handle callback query for transaction confirmation
  async handleCallbackQuery(ctx: Context): Promise<boolean> {
    const callbackQuery = ctx.callbackQuery as CallbackQuery.DataQuery;
    if (!callbackQuery?.data) return false;

    // Only handle callbacks that start with 'add_'
    if (!callbackQuery.data.startsWith('add_')) return false;

    const chatId = callbackQuery.message?.chat.id.toString();
    if (!chatId) return false;

    const transaction = this.commandHandlers.getTransactionData(chatId);
    if (!transaction) {
      await ctx.answerCbQuery('Transaction data expired, please enter again.');
      return true;
    }

    if (callbackQuery.data === 'add_confirm') {
      try {
        // Save transaction
        await this.accountingService.addTransaction(transaction);

        // Clear transaction data
        this.commandHandlers.clearTransactionData(chatId);

        // Update the original message
        const successMessage = this.generateTransactionMessage(transaction, '✅');
        await ctx.editMessageText(successMessage, { parse_mode: 'HTML' });
        await ctx.answerCbQuery('Transaction saved!');
      } catch (error) {
        this.logger.error('Error saving transaction:', error);
        await ctx.answerCbQuery('Error saving transaction, please try again.');
      }
    } else if (callbackQuery.data === 'add_cancel') {
      // Clear transaction data
      this.commandHandlers.clearTransactionData(chatId);

      // Update the original message
      const cancelMessage = this.generateTransactionMessage(transaction, '❌');
      await ctx.editMessageText(cancelMessage, { parse_mode: 'HTML' });
      await ctx.reply('Transaction cancelled.');
    }

    return true;
  }
} 