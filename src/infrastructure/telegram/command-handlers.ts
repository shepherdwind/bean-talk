import { Context } from 'telegraf';
import { ILogger, container, Logger } from '../utils';
import { PendingCategorization } from './types';
import { Telegraf } from 'telegraf';
import { CategorizationCommandHandler } from './commands/categorization-command-handler';
import { QueryCommandHandler } from './commands/query-command-handler';

export class CommandHandlers {
  private logger: ILogger;
  private bot: Telegraf;
  private categorizationHandler: CategorizationCommandHandler;
  private queryHandler: QueryCommandHandler;

  constructor(bot: Telegraf) {
    this.logger = container.getByClass(Logger);
    this.bot = bot;
    
    this.categorizationHandler = new CategorizationCommandHandler(
      bot,
    );
    
    this.queryHandler = new QueryCommandHandler();
    
    this.logger.debug('Initializing CommandHandlers');
    this.logger.debug(`Bot instance: ${this.bot ? 'Valid' : 'Invalid'}`);
    
    this.setupMessageHandler();
    this.setupCommandHandlers();
    
    this.logger.debug('CommandHandlers initialization complete');
  }

  private setupMessageHandler(): void {
    this.logger.debug('Setting up message handler in CommandHandlers');
    
    this.bot.on('message', async (ctx) => {
      await this.categorizationHandler.handleMessage(ctx);
    });
    
    this.logger.debug('Message handler setup complete in CommandHandlers');
  }

  private setupCommandHandlers(): void {
    this.logger.debug('Setting up command handlers in CommandHandlers');
    
    // Set up start command
    this.bot.command('start', (ctx) => this.handleStart(ctx));
    
    this.logger.debug('Command handlers setup complete in CommandHandlers');
  }

  async handleStart(ctx: Context): Promise<void> {
    await ctx.reply('👋 Welcome to Bean Talk! I\'m here to help you manage your finances.\n\nI can help you:\n- Categorize merchants\n- Query your transactions\n- And more coming soon!');
  }

  // 发送通知
  async sendNotification(chatId: string, message: string, merchantId?: string, categorizationData?: PendingCategorization): Promise<void> {
    try {
      if (merchantId && categorizationData) {
        // 如果需要分类，使用 categorizationHandler
        await this.categorizationHandler.sendNotification(chatId, message, merchantId, categorizationData);
      } else {
        // 普通通知直接发送
        await this.bot.telegram.sendMessage(chatId, message);
      }
    } catch (error) {
      this.logger.error(`Failed to send notification to chat ${chatId}:`, error);
      throw error;
    }
  }
} 