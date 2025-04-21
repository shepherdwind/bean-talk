import { Context } from 'telegraf';
import { CallbackQuery } from 'telegraf/typings/core/types/typegram';
import { BaseCommandHandler } from './base-command-handler';
import { AccountingService } from '../../../domain/services/accounting.service';
import { container } from '../../utils';
import { Transaction } from '../../../domain/models/transaction';
import { AccountName } from '../../../domain/models/account';
import { Amount, Currency } from '../../../domain/models/types';
import { OpenAIAdapter } from '../../../infrastructure/openai/openai.adapter';
import { Telegraf } from 'telegraf';
import { CommandHandlers, UserState } from '../command-handlers';

export class AddCommandHandler extends BaseCommandHandler {
  private accountingService: AccountingService;
  private openaiAdapter: OpenAIAdapter;
  private bot: Telegraf;
  private commandHandlers: CommandHandlers;

  constructor(bot: Telegraf, commandHandlers: CommandHandlers) {
    super();
    this.bot = bot;
    this.commandHandlers = commandHandlers;
    this.accountingService = container.getByClass(AccountingService);
    this.openaiAdapter = container.getByClass(OpenAIAdapter);

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

    // Check if user is in adding bill state
    const userState = this.commandHandlers.getUserState(chatId);
    if (userState !== UserState.ADDING_BILL) {
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
      await this.processBillInput(ctx, text);
      return true; // Message handled
    } catch (error) {
      this.logger.error('Error processing bill input:', error);
      await ctx.reply('Sorry, there was an error processing your bill information. Please try again.');
      return true; // Message handled
    }
  }

  private async processBillInput(ctx: Context, input: string): Promise<void> {
    const chatId = ctx.chat?.id.toString();
    if (!chatId) return;

    try {
      await ctx.reply('Processing your bill information...');

      // Get the username from the message
      const username = ctx.from?.username;
      if (!username) {
        await ctx.reply('Unable to identify user. Please ensure your Telegram account has a username set.');
        return;
      }

      // Determine which account to use based on username
      let account: AccountName;
      if (username.toLowerCase() === 'lingerzou') {
        account = AccountName.AssetsCashWife;
      } else if (username.toLowerCase() === 'ewardsong') {
        account = AccountName.AssetsCash;
      } else {
        await ctx.reply('Sorry, you do not have permission to use this feature.');
        return;
      }

      // Use AI to parse the input and create a transaction
      const prompt = `Please parse the following expense information and create a transaction record:
"${input}"

Please extract the following information:
1. Amount (number)
2. Currency (string, must be one of: ${Object.values(Currency).join(', ')}, if no currency specified, return "SGD")
3. Description (string)
4. Category (string, must be one of: ${Object.values(AccountName).filter(acc => acc.startsWith('Expenses:')).join(', ')})

Please respond with ONLY a clean JSON object in this exact format, without any markdown formatting or additional text:
{
  "amount": number,
  "currency": "string",
  "description": "string",
  "category": "string"
}`;

      const response = await this.openaiAdapter.processMessage(prompt, '');
      const transactionData = JSON.parse(response);

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
          telegramUsername: username
        }
      };

      // Send confirmation message with buttons
      const message = 
        'Please confirm the following transaction:\n\n' +
        `Amount: ${transactionData.amount} ${transactionData.currency}\n` +
        `Description: ${transactionData.description}\n` +
        `Account: ${account}\n` +
        `Category: ${transactionData.category}\n\n` +
        'Please select:';

      // Store transaction data in user state for later use
      this.commandHandlers.setTransactionData(chatId, transaction);

      // Send confirmation buttons
      await ctx.reply(message, {
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

    // Remove the buttons from the message
    if (callbackQuery.message?.message_id) {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    }

    if (callbackQuery.data === 'add_confirm') {
      try {
        // Save transaction
        await this.accountingService.addTransaction(transaction);

        // Clear transaction data
        this.commandHandlers.clearTransactionData(chatId);

        // Send success message
        await ctx.answerCbQuery('Transaction saved!');
        await ctx.reply('✅ Transaction successfully saved!');
      } catch (error) {
        this.logger.error('Error saving transaction:', error);
        await ctx.answerCbQuery('Error saving transaction, please try again.');
      }
    } else if (callbackQuery.data === 'add_cancel') {
      // Clear transaction data
      this.commandHandlers.clearTransactionData(chatId);

      // Send cancellation message
      await ctx.answerCbQuery('Transaction cancelled');
      await ctx.reply('Transaction cancelled.');
    }

    return true;
  }
} 