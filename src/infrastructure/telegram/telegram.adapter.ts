import { Telegraf } from 'telegraf';
import { ILogger, container, Logger } from '../utils';

export class TelegramAdapter {
  private bot: Telegraf;
  private logger: ILogger;
  private chatId: string;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required in environment variables');
    }
    this.bot = new Telegraf(token);
    this.logger = container.getByClass(Logger);
    
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      this.logger.warn('TELEGRAM_CHAT_ID not found in environment variables');
    }
    this.chatId = chatId || '';

    // Set up command handlers
    this.bot.command('start', (ctx) => {
      ctx.reply('Welcome to BeanTalk! Your personal finance assistant.');
    });
  }

  async init(): Promise<void> {
    try {
      this.logger.info('Initializing Telegram bot...');
      await this.bot.launch();
      this.logger.info('Telegram bot initialized successfully');

      // Enable graceful stop
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    } catch (error) {
      this.logger.error('Failed to initialize Telegram bot:', error);
      throw error;
    }
  }

  async sendNotification(message: string): Promise<void> {
    if (!this.chatId) {
      this.logger.warn('No chat ID configured for Telegram notifications');
      return;
    }

    try {
      await this.bot.telegram.sendMessage(this.chatId, message);
      this.logger.info(`Notification sent to chat ${this.chatId}`);
    } catch (error) {
      this.logger.error(`Failed to send notification to chat ${this.chatId}:`, error);
      throw error;
    }
  }
} 