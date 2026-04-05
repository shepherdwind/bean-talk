import { Bot } from 'grammy';
import { createConversation } from '@grammyjs/conversations';
import { ILogger, container, Logger } from '../utils';
import { BotContext } from './grammy-types';
import { createBot } from './bot';
import { addBillConversation, ADD_BILL_CONVERSATION_ID } from './conversations/add-bill';
import { categorizationConversation, CATEGORIZATION_CONVERSATION_ID } from './conversations/categorization';
import { QueryCommandHandler } from './commands/query-command-handler';
import { CustomQueryCommandHandler } from './commands/custom-query-command-handler';
import { CALLBACK_PREFIXES } from './commands/categorization-constants';

// Short ID → full merchant data mapping for callback data (Telegram 64-byte limit)
const pendingMerchantRegistry = new Map<string, { merchantId: string; merchant: string }>();
const shortIdToMerchantId = new Map<string, string>();

function generateShortId(merchantId: string): string {
  let hash = 0;
  for (let i = 0; i < merchantId.length; i++) {
    const char = merchantId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

export function getPendingMerchant(shortId: string): { merchantId: string; merchant: string } | undefined {
  const merchantId = shortIdToMerchantId.get(shortId);
  if (!merchantId) return undefined;
  return pendingMerchantRegistry.get(merchantId);
}

export function removePendingMerchant(shortId: string): void {
  const merchantId = shortIdToMerchantId.get(shortId);
  if (merchantId) {
    pendingMerchantRegistry.delete(merchantId);
    shortIdToMerchantId.delete(shortId);
  }
}

export function removePendingMerchantByMerchantId(merchantId: string): void {
  pendingMerchantRegistry.delete(merchantId);
  for (const [shortId, mid] of shortIdToMerchantId.entries()) {
    if (mid === merchantId) {
      shortIdToMerchantId.delete(shortId);
      break;
    }
  }
}

export class TelegramAdapter {
  private bot: Bot<BotContext>;
  private logger: ILogger;
  private chatId: string;

  constructor() {
    this.logger = container.getByClass(Logger);

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN is required in environment variables');
      throw new Error('TELEGRAM_BOT_TOKEN is required in environment variables');
    }

    const sessionDir = process.env.SESSION_DIR || './data/sessions';
    this.bot = createBot({ token, sessionDir });

    this.setupConversations();
    this.setupCommandHandlers();

    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      this.logger.warn('TELEGRAM_CHAT_ID not found in environment variables');
    }
    this.chatId = chatId || '';
  }

  private setupConversations(): void {
    this.bot.use(createConversation(addBillConversation, ADD_BILL_CONVERSATION_ID));
    this.bot.use(createConversation(categorizationConversation, CATEGORIZATION_CONVERSATION_ID));
  }

  private setupCommandHandlers(): void {
    // /add enters the add-bill conversation
    this.bot.command('add', async (ctx) => {
      await ctx.conversation.enter(ADD_BILL_CONVERSATION_ID);
    });

    // /query shows time range selection
    const queryHandler = new QueryCommandHandler(this.bot);
    queryHandler.registerCallbackHandlers();
    this.bot.command('query', async (ctx) => {
      await queryHandler.handle(ctx);
    });

    // /cancel — handled within conversations; standalone cancel does nothing
    this.bot.command('cancel', async (ctx) => {
      await ctx.reply('No active operation to cancel.');
    });

    // Categorize merchant button → enters categorization conversation
    this.bot.callbackQuery(new RegExp(`^${CALLBACK_PREFIXES.CATEGORIZE_MERCHANT}`), async (ctx) => {
      await ctx.conversation.enter(CATEGORIZATION_CONVERSATION_ID);
    });

    // Custom query — free text starting with 查
    const customQueryHandler = new CustomQueryCommandHandler(this.bot);
    this.bot.on('message:text', async (ctx) => {
      await customQueryHandler.handle(ctx);
    });
  }

  async init(): Promise<void> {
    try {
      this.bot.catch((err) => {
        this.logger.error('Bot error occurred:', err);
      });

      await this.bot.api.setMyCommands([
        { command: 'start', description: 'Start the bot' },
        { command: 'add', description: 'Add a new bill' },
        { command: 'query', description: 'Query transactions' },
      ]);

      // bot.start() begins long polling and never resolves — do not await
      this.bot.start({
        onStart: () => this.logger.info('Telegram bot polling started'),
      });

      process.once('SIGINT', () => this.bot.stop());
      process.once('SIGTERM', () => this.bot.stop());
    } catch (error) {
      this.logger.error('Failed to initialize Telegram bot:', error);
      throw error;
    }
  }

  async sendNotification(message: string, merchantId?: string, categorizationData?: { merchant?: string; merchantId?: string }): Promise<void> {
    if (!this.chatId) {
      this.logger.warn('No chat ID configured for Telegram notifications');
      return;
    }

    const maxRetries = 3;
    let retryCount = 0;

    this.logger.debug(`Sending notification to chat ${this.chatId}, message: ${message}`);

    while (retryCount < maxRetries) {
      try {
        if (merchantId) {
          const merchant = categorizationData?.merchant || merchantId;
          pendingMerchantRegistry.set(merchantId, { merchantId, merchant });
          const shortId = generateShortId(merchantId);
          shortIdToMerchantId.set(shortId, merchantId);

          await this.bot.api.sendMessage(this.chatId, message, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '🤖 Categorize with AI', callback_data: `${CALLBACK_PREFIXES.CATEGORIZE_MERCHANT}${shortId}` },
              ]],
            },
          });
        } else {
          await this.bot.api.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
        }
        this.logger.info(`Notification sent to chat ${this.chatId}`);
        return;
      } catch (error) {
        retryCount++;
        this.logger.error(`Failed to send notification (attempt ${retryCount}/${maxRetries}):`, error);
        if (retryCount === maxRetries) {
          this.logger.error('Maximum retry attempts reached, giving up');
        }
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  getBotInstance(): Bot<BotContext> {
    return this.bot;
  }
}
