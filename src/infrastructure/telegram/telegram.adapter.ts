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
    this.logger.debug('Initializing TelegramAdapter...');
    
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.logger.debug(`TELEGRAM_BOT_TOKEN available: ${!!token}`);
    
    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN is required in environment variables');
      throw new Error('TELEGRAM_BOT_TOKEN is required in environment variables');
    }
    
    this.bot = new Telegraf(token);
    this.logger.debug('Telegraf bot instance created');
    
    this.commandHandlers = new CommandHandlers(this.bot);
    this.logger.debug('CommandHandlers initialized');
    
    const chatId = process.env.TELEGRAM_CHAT_ID;
    this.logger.debug(`TELEGRAM_CHAT_ID available: ${!!chatId}`);
    
    if (!chatId) {
      this.logger.warn('TELEGRAM_CHAT_ID not found in environment variables');
    }
    this.chatId = chatId || '';

    this.logger.debug('TelegramAdapter initialization complete');
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

  async sendNotification(message: string, merchantId?: string, categorizationData?: PendingCategorization): Promise<void> {
    if (!this.chatId) {
      this.logger.warn('No chat ID configured for Telegram notifications');
      return;
    }

    try {
      // 使用 CommandHandlers 的 sendNotification 方法
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