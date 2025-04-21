import { Telegraf } from 'telegraf';
import { ILogger, container, Logger } from '../utils';
import { NLPService } from '../../domain/services/nlp.service';
import { CommandHandlers } from './command-handlers';
import { PendingCategorization } from './types';

export class TelegramAdapter {
  private bot: Telegraf;
  private logger: ILogger;
  private chatId: string;
  private commandHandlers: CommandHandlers;

  constructor() {
    this.logger = container.getByClass(Logger);
    
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN is required in environment variables');
      throw new Error('TELEGRAM_BOT_TOKEN is required in environment variables');
    }
    
    try {
      this.bot = new Telegraf(token);
    } catch (error) {
      this.logger.error('Failed to create Telegraf instance:', error);
      throw error;
    }
    
    try {
      this.commandHandlers = new CommandHandlers(this.bot);
    } catch (error) {
      this.logger.error('Failed to initialize CommandHandlers:', error);
      throw error;
    }
    
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      this.logger.warn('TELEGRAM_CHAT_ID not found in environment variables');
    }
    this.chatId = chatId || '';
  }

  private async setupCommands(): Promise<void> {
    try {
      await this.bot.telegram.setMyCommands([
        { command: 'start', description: 'Start the bot and see welcome message' },
        { command: 'add', description: 'Add a new bill' }
      ]);
    } catch (error) {
      this.logger.error('Failed to set up bot commands:', error);
    }
  }

  async init(): Promise<void> {
    try {
      // Add error handler for the bot
      this.bot.catch((err: any) => {
        this.logger.error('Bot error occurred:', err);
      });

      // Try to get bot info before launch
      try {
        await this.bot.telegram.getMe();
      } catch (error) {
        this.logger.error('Failed to get bot info:', error);
      }

      // Set up bot commands
      await this.setupCommands();

      // Launch the bot
      await this.bot.launch();

      // Enable graceful stop
      process.once('SIGINT', () => this.bot.stop());
      process.once('SIGTERM', () => this.bot.stop());
    } catch (error) {
      this.logger.error('Failed to initialize Telegram bot:', error);
      throw error;
    }
  }

  async sendNotification(message: string, merchantId?: string, categorizationData?: PendingCategorization): Promise<void> {
    if (!this.chatId) {
      this.logger.warn('No chat ID configured for Telegram notifications');
      return;
    }

    try {
      await this.commandHandlers.sendNotification(
        this.chatId,
        message,
        merchantId,
        categorizationData
      );
    } catch (error) {
      this.logger.error(`Failed to send notification to chat ${this.chatId}:`, error);
      throw error;
    }
  }
} 