import { Context } from 'telegraf';
import { ILogger, container, Logger } from '../utils';
import { PendingCategorization } from './types';
import { Telegraf } from 'telegraf';
import { CategorizationCommandHandler } from './commands/categorization-command-handler';
import { QueryCommandHandler } from './commands/query-command-handler';
import { AddCommandHandler } from './commands/add-command-handler';

export class CommandHandlers {
  private logger: ILogger;
  private bot: Telegraf;
  private categorizationHandler: CategorizationCommandHandler;
  private queryHandler: QueryCommandHandler;
  private addHandler: AddCommandHandler;

  constructor(bot: Telegraf) {
    this.logger = container.getByClass(Logger);
    this.bot = bot;
    
    this.categorizationHandler = new CategorizationCommandHandler(
      bot,
    );
    
    this.queryHandler = new QueryCommandHandler();
    this.addHandler = new AddCommandHandler();
    
    this.setupMessageHandler();
    this.setupCommandHandlers();
  }

  private setupMessageHandler(): void {
    // 只处理非命令消息
    this.bot.on('message', async (ctx, next) => {
      if (ctx.message && 'text' in ctx.message && !ctx.message.text.startsWith('/')) {
        await this.handleMessage(ctx);
      } else {
        next();
      }
    });
  }

  private setupCommandHandlers(): void {
    // Set up start command
    this.bot.command('start', async (ctx) => {
      try {
        await this.handleStart(ctx);
      } catch (error) {
        this.logger.error('Error handling start command:', error);
        await ctx.reply('Sorry, I encountered an error while processing your command.');
      }
    });
    
    // Set up add command
    this.bot.command('add', async (ctx) => {
      try {
        await this.addHandler.handle(ctx);
      } catch (error) {
        this.logger.error('Error handling add command:', error);
        await ctx.reply('Sorry, I encountered an error while processing your command.');
      }
    });
  }

  async handleStart(ctx: Context): Promise<void> {
    await ctx.reply('👋 Welcome to Bean Talk! I\'m here to help you manage your finances.\n\nI can help you:\n- Categorize merchants\n- Query your transactions\n- Add new bills\n- And more coming soon!');
  }

  async handleMessage(ctx: Context): Promise<void> {
    try {
      await this.categorizationHandler.handleMessage(ctx);
    } catch (error) {
      this.logger.error('Error handling message:', error);
      await ctx.reply('Sorry, I encountered an error while processing your message.');
    }
  }

  // 发送通知
  async sendNotification(chatId: string, message: string, merchantId?: string, categorizationData?: PendingCategorization): Promise<void> {
    try {
      if (merchantId && categorizationData) {
        // 如果需要分类，使用 categorizationHandler
        await this.categorizationHandler.sendNotification(chatId, message, merchantId, categorizationData);
      } else {
        // 普通通知直接发送
        await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
      }
    } catch (error) {
      this.logger.error(`Failed to send notification to chat ${chatId}:`, error);
      throw error;
    }
  }
} 