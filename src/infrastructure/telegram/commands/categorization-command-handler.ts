import { Context, Markup } from 'telegraf';
import { CallbackQuery } from 'telegraf/typings/core/types/typegram';
import { BaseCommandHandler } from './base-command-handler';
import { NLPService } from '../../../domain/services/nlp.service';
import { PendingCategorization } from '../types';
import { Telegraf } from 'telegraf';
import { ApplicationEventEmitter } from '../../events/event-emitter';
import { container, ILogger, Logger } from '../../utils';
import { 
  CALLBACK_PREFIXES, 
  MESSAGES, 
  CATEGORY_TYPES 
} from './categorization-constants';
import { 
  generateShortId, 
  createCategoryKeyboard, 
  createCategoryResultMessage,
  getShortId,
  findPendingCategorization
} from './categorization-utils';
import { 
  CategorizationData, 
  CategorizationMap, 
  CategorySelectionEventData 
} from './categorization-types';
import { EventTypes } from '../../events/event-types';
import { CommandHandlers, UserState } from '../command-handlers';

export class CategorizationCommandHandler extends BaseCommandHandler {
  private nlpService: NLPService;
  private pendingCategorizations: Map<string, PendingCategorization>;
  private bot: Telegraf;
  private eventEmitter: ApplicationEventEmitter;
  private categorizationMap: CategorizationMap;
  private truncatedIdMap: Map<string, string> = new Map(); // Map truncated IDs to full merchant IDs
  protected logger: ILogger;
  private commandHandlers: CommandHandlers;

  constructor(
    bot: Telegraf,
    commandHandlers: CommandHandlers
  ) {
    super();
    this.nlpService = container.getByClass(NLPService);
    this.pendingCategorizations = new Map<string, PendingCategorization>();
    this.bot = bot;
    this.commandHandlers = commandHandlers;
    this.eventEmitter = container.getByClass(ApplicationEventEmitter);
    this.categorizationMap = new Map<string, CategorizationData>();
    this.logger = container.getByClass(Logger);
    
    // Set up callback query handler
    this.bot.on('callback_query', async (ctx, next) => {
      const handled = await this.handleCallbackQuery(ctx);
      if (!handled) {
        return next();
      }
    });
  }

  // Handle callback query
  async handleCallbackQuery(ctx: Context): Promise<boolean> {
    const callbackQuery = ctx.callbackQuery as CallbackQuery.DataQuery;
    if (!callbackQuery?.data) return false;

    // Only handle callbacks that start with our prefixes
    if (!callbackQuery.data.startsWith('sc:') && 
        !callbackQuery.data.startsWith('cc:') && 
        !callbackQuery.data.startsWith(CALLBACK_PREFIXES.CATEGORIZE_MERCHANT)) {
      return false;
    }

    try {
      if (callbackQuery.data.startsWith(CALLBACK_PREFIXES.CATEGORIZE_MERCHANT)) {
        const truncatedId = callbackQuery.data.slice(CALLBACK_PREFIXES.CATEGORIZE_MERCHANT.length);
        await this.handleCategorizeMerchantCallback(ctx, truncatedId);
      } else if (callbackQuery.data.startsWith('sc:')) {
        const [, shortId, categoryType] = callbackQuery.data.split(':');
        await this.handleCategorySelection(ctx, shortId, categoryType);
      } else if (callbackQuery.data.startsWith('cc:')) {
        const shortId = callbackQuery.data.slice(3);
        await this.handleCategoryCancel(ctx, shortId);
      }
      return true;
    } catch (error) {
      this.logger.error('Error handling callback query:', error);
      await ctx.answerCbQuery('Sorry, I encountered an error while processing your request.');
      return true;
    }
  }

  // 实现抽象方法
  async handle(ctx: Context, ...args: any[]): Promise<void> {
    // 默认处理逻辑，可以根据需要扩展
    await ctx.reply('Categorization command received.');
  }

  // 获取待处理的分类
  getPendingCategorization(merchantId: string): PendingCategorization | undefined {
    return this.pendingCategorizations.get(merchantId);
  }

  // 删除待处理的分类
  removePendingCategorization(merchantId: string): void {
    this.pendingCategorizations.delete(merchantId);
  }

  // 添加短ID映射
  addTruncatedIdMapping(shortId: string, merchantId: string): void {
    this.truncatedIdMap.set(shortId, merchantId);
  }

  // 获取完整的商家ID
  getFullMerchantId(truncatedId: string): string | undefined {
    return this.truncatedIdMap.get(truncatedId);
  }

  // 发送通知
  async sendNotification(chatId: string, message: string, merchantId?: string, categorizationData?: PendingCategorization): Promise<void> {
    if (!chatId) {
      this.logger.warn('No chat ID provided for Telegram notification');
      return;
    }

    try {
      let keyboard;
      if (merchantId) {
        // 生成短ID
        const shortId = getShortId(merchantId);
        this.addTruncatedIdMapping(shortId, merchantId);
        
        keyboard = Markup.inlineKeyboard([
          Markup.button.callback('🤖 Categorize with AI', `${CALLBACK_PREFIXES.CATEGORIZE_MERCHANT}${shortId}`)
        ]);
      }

      await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML', ...keyboard });
      
      if (merchantId && categorizationData) {
        this.pendingCategorizations.set(merchantId, categorizationData);
      }
      
      this.logger.info(`Notification sent to chat ${chatId}`);
    } catch (error) {
      this.logger.error(`Failed to send notification to chat ${chatId}:`, error);
      throw error;
    }
  }

  async handleCategorizeMerchantCallback(ctx: Context, truncatedId: string): Promise<void> {
    const fullMerchantId = this.getFullMerchantId(truncatedId);
    if (!fullMerchantId) {
      this.logger.error(MESSAGES.ERROR_NO_MAPPING_FOUND(truncatedId));
      await ctx.answerCbQuery(MESSAGES.ERROR_MERCHANT_ID_NOT_FOUND);
      return;
    }
    
    const pendingCategorization = this.getPendingCategorization(fullMerchantId);
    
    if (!pendingCategorization) {
      await ctx.answerCbQuery(MESSAGES.ERROR_CATEGORIZATION_NOT_FOUND);
      return;
    }

    try {
      // Remove the "Categorize with AI" button immediately after click
      if (ctx.callbackQuery?.message?.message_id) {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      }

      await ctx.answerCbQuery();
      await ctx.reply(MESSAGES.CATEGORIZATION_PROMPT(pendingCategorization.merchant), { parse_mode: 'HTML' });

      if (ctx.chat?.id) {
        const chatId = ctx.chat.id.toString();
        // 设置用户状态为分类中
        this.commandHandlers.setUserState(chatId, UserState.CATEGORIZING);
        pendingCategorization.chatId = chatId;
        this.pendingCategorizations.set(fullMerchantId, pendingCategorization);
      }
    } catch (error) {
      this.logger.error('Error handling AI categorization:', error);
      await ctx.reply(MESSAGES.CATEGORIZATION_REQUEST_ERROR);
    }
  }

  async handleMessage(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id.toString();
    const username = ctx.from?.username || 'unknown';
    this.logger.debug(`Message received from chat ID: ${chatId}, username: ${username}`);
    
    if (!chatId || !ctx.message || !('text' in ctx.message)) {
      this.logger.debug(`Skipping message: Invalid message format or missing chat ID`);
      return;
    }

    // 检查用户是否处于分类状态
    const userState = this.commandHandlers.getUserState(chatId);
    if (userState === UserState.CATEGORIZING) {
      const pendingCategorization = findPendingCategorization(this.pendingCategorizations, chatId);
      
      if (pendingCategorization) {
        await this.processCategorizationRequest(ctx, pendingCategorization, ctx.message.text);
      }
    }
  }

  private async processCategorizationRequest(ctx: Context, pendingCategorization: PendingCategorization, userInput: string): Promise<void> {
    try {
      await ctx.reply(MESSAGES.ANALYZING);
      
      const categories = await this.nlpService.categorizeMerchant(pendingCategorization.merchant, userInput);
      
      const shortId = generateShortId();
      this.categorizationMap.set(shortId, {
        merchantId: pendingCategorization.merchantId,
        categories: {
          primary: categories.primaryCategory,
          alternative: categories.alternativeCategory,
          suggested: categories.suggestedNewCategory
        }
      });
      
      const keyboard = createCategoryKeyboard(shortId, {
        primary: categories.primaryCategory,
        alternative: categories.alternativeCategory,
        suggested: categories.suggestedNewCategory
      });

      await ctx.reply(
        createCategoryResultMessage(pendingCategorization.merchant, {
          primary: categories.primaryCategory,
          alternative: categories.alternativeCategory,
          suggested: categories.suggestedNewCategory
        }),
        { reply_markup: keyboard }
      );
    } catch (error) {
      this.logger.error('Error processing categorization:', error);
      await ctx.reply(MESSAGES.CATEGORIZATION_ERROR);
    }
  }

  async handleCategorySelection(ctx: Context, shortId: string, categoryType: string): Promise<void> {
    const chatId = ctx.chat?.id.toString();
    
    if (!chatId) {
      await ctx.answerCbQuery(MESSAGES.ERROR_CHAT_ID_NOT_FOUND);
      return;
    }

    const categorizationData = this.categorizationMap.get(shortId);
    if (!categorizationData) {
      await ctx.answerCbQuery(MESSAGES.ERROR_CATEGORIZATION_NOT_FOUND);
      return;
    }

    const { merchantId, categories } = categorizationData;
    const selectedCategory = categories[categoryType as keyof typeof categories];
    if (!selectedCategory) {
      await ctx.answerCbQuery(MESSAGES.ERROR_INVALID_CATEGORY_TYPE);
      return;
    }

    const pendingCategorization = this.getPendingCategorization(merchantId);
    if (!pendingCategorization) {
      await ctx.answerCbQuery(MESSAGES.ERROR_CATEGORIZATION_NOT_FOUND);
      return;
    }

    const eventData: CategorySelectionEventData = {
      merchantId: pendingCategorization.merchantId,
      merchant: pendingCategorization.merchant,
      selectedCategory: selectedCategory,
      timestamp: new Date().toISOString()
    };
    
    this.eventEmitter.emit(EventTypes.MERCHANT_CATEGORY_SELECTED, eventData);

    await ctx.editMessageText(
      MESSAGES.CATEGORY_SELECTED(pendingCategorization.merchant, selectedCategory)
    );

    this.removePendingCategorization(merchantId);
    // 重置用户状态为空闲
    this.commandHandlers.resetUserState(chatId);
    this.categorizationMap.delete(shortId);
  }

  async handleCategoryCancel(ctx: Context, shortId: string): Promise<void> {
    const chatId = ctx.chat?.id.toString();
    
    if (!chatId) {
      await ctx.answerCbQuery(MESSAGES.ERROR_CHAT_ID_NOT_FOUND);
      return;
    }

    const categorizationData = this.categorizationMap.get(shortId);
    if (!categorizationData) {
      await ctx.answerCbQuery(MESSAGES.ERROR_CATEGORIZATION_NOT_FOUND);
      return;
    }

    const { merchantId } = categorizationData;
    const pendingCategorization = this.getPendingCategorization(merchantId);
    if (!pendingCategorization) {
      await ctx.answerCbQuery(MESSAGES.ERROR_CATEGORIZATION_NOT_FOUND);
      return;
    }

    await ctx.editMessageText(MESSAGES.CATEGORIZATION_CANCELLED);
    
    this.eventEmitter.emit(EventTypes.MERCHANT_CATEGORY_SELECTED, {
      merchantId: pendingCategorization.merchantId,
      merchant: pendingCategorization.merchant,
      selectedCategory: null,
      timestamp: new Date().toISOString()
    });

    this.removePendingCategorization(merchantId);
    // 重置用户状态为空闲
    this.commandHandlers.resetUserState(chatId);
    this.categorizationMap.delete(shortId);
  }
} 