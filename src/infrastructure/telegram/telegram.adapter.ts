import { Telegraf, Markup } from 'telegraf';
import { ILogger, container, Logger } from '../utils';
import { NLPService } from '../../domain/services/nlp.service';
import { CommandHandlers } from './command-handlers';
import { PendingCategorization } from './types';

export class TelegramAdapter {
  private bot: Telegraf;
  private logger: ILogger;
  private chatId: string;
  private nlpService: NLPService;
  private pendingCategorizations: Map<string, PendingCategorization> = new Map();
  private commandHandlers: CommandHandlers;
  private truncatedIdMap: Map<string, string> = new Map(); // Map truncated IDs to full merchant IDs

  constructor() {
    this.logger = container.getByClass(Logger);
    this.logger.debug('Initializing TelegramAdapter...');
    
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.logger.debug(`TELEGRAM_BOT_TOKEN available: ${!!token}`);
    
    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN is required in environment variables');
      throw new Error('TELEGRAM_BOT_TOKEN is required in environment variables');
    }
    
    this.bot = new Telegraf(token);
    this.logger.debug('Telegraf bot instance created');
    
    this.nlpService = container.getByClass(NLPService);
    this.commandHandlers = new CommandHandlers(this.bot, this.pendingCategorizations);
    this.logger.debug('CommandHandlers initialized');
    
    const chatId = process.env.TELEGRAM_CHAT_ID;
    this.logger.debug(`TELEGRAM_CHAT_ID available: ${!!chatId}`);
    
    if (!chatId) {
      this.logger.warn('TELEGRAM_CHAT_ID not found in environment variables');
    }
    this.chatId = chatId || '';

    this.setupCommandHandlers();
    this.logger.debug('TelegramAdapter initialization complete');
  }

  private setupCommandHandlers(): void {
    this.logger.debug('Setting up command handlers');
    
    // Set up command handlers
    this.bot.command('start', (ctx) => this.commandHandlers.handleStart(ctx));

    // Handle AI categorization callback
    this.bot.action(/categorize_merchant_(.+)/, async (ctx) => {
      const truncatedId = ctx.match[1];
      const fullMerchantId = this.truncatedIdMap.get(truncatedId);
      if (!fullMerchantId) {
        this.logger.error(`No mapping found for truncated ID: ${truncatedId}`);
        await ctx.answerCbQuery('Error: Merchant ID not found');
        return;
      }
      await this.commandHandlers.handleCategorizeMerchant(ctx, fullMerchantId);
    });
    
    this.logger.debug('Command handlers setup complete');
  }

  async init(): Promise<void> {
    try {
      this.logger.debug('Starting Telegram bot initialization...');
      this.logger.debug(`Bot token available: ${!!process.env.TELEGRAM_BOT_TOKEN}`);
      this.logger.debug(`Chat ID: ${this.chatId || 'Not set'}`);
      
      this.logger.info('Initializing Telegram bot...');
      await this.bot.launch();
      this.logger.info('Telegram bot initialized successfully');

      // Enable graceful stop
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
      
      this.logger.debug('Telegram bot initialization complete');
    } catch (error) {
      this.logger.error('Failed to initialize Telegram bot:', error);
      this.logger.debug('Error details:', error);
      throw error;
    }
  }

  private getShortId(merchantId: string): string {
    // Generate a short hash of the merchantId
    let hash = 0;
    for (let i = 0; i < merchantId.length; i++) {
      const char = merchantId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to base36 and take first 8 characters
    return Math.abs(hash).toString(36).slice(0, 8);
  }

  async sendNotification(message: string, merchantId?: string, categorizationData?: PendingCategorization): Promise<void> {
    if (!this.chatId) {
      this.logger.warn('No chat ID configured for Telegram notifications');
      return;
    }

    try {
      let keyboard;
      if (merchantId) {
        // Generate a unique short ID
        const shortId = this.getShortId(merchantId);
        this.truncatedIdMap.set(shortId, merchantId);
        
        keyboard = Markup.inlineKeyboard([
          Markup.button.callback('🤖 Categorize with AI', `categorize_merchant_${shortId}`)
        ]);
      }

      await this.bot.telegram.sendMessage(this.chatId, message, keyboard);
      
      if (merchantId && categorizationData) {
        this.pendingCategorizations.set(merchantId, categorizationData);
      }
      
      this.logger.info(`Notification sent to chat ${this.chatId}`);
    } catch (error) {
      this.logger.error(`Failed to send notification to chat ${this.chatId}:`, error);
      throw error;
    }
  }
} 