import { Context, Markup } from 'telegraf';
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

export class CategorizationCommandHandler extends BaseCommandHandler {
  private nlpService: NLPService;
  private pendingCategorizations: Map<string, PendingCategorization>;
  private bot: Telegraf;
  private activeCategorizations: Set<string>;
  private eventEmitter: ApplicationEventEmitter;
  private categorizationMap: CategorizationMap;
  private truncatedIdMap: Map<string, string> = new Map(); // Map truncated IDs to full merchant IDs
  protected logger: ILogger;

  constructor(
    bot: Telegraf,
  ) {
    super();
    this.nlpService = container.getByClass(NLPService);
    this.pendingCategorizations = new Map<string, PendingCategorization>();
    this.bot = bot;
    this.activeCategorizations = new Set<string>();
    this.eventEmitter = container.getByClass(ApplicationEventEmitter);
    this.categorizationMap = new Map<string, CategorizationData>();
    this.logger = container.getByClass(Logger);
    
    // 设置 action handlers
    this.setupActionHandlers();
  }

  // 设置 action handlers
  private setupActionHandlers(): void {
    this.logger.debug('Setting up action handlers in CategorizationCommandHandler');
    
    // 处理分类商家的回调
    this.bot.action(new RegExp(`${CALLBACK_PREFIXES.CATEGORIZE_MERCHANT}(.+)`), async (ctx) => {
      const truncatedId = ctx.match[1];
      await this.handleCategorizeMerchantCallback(ctx, truncatedId);
    });
    
    // 处理分类选择
    this.bot.action(/^sc:(.+):(.+)$/, async (ctx) => {
      const shortId = ctx.match[1];
      const categoryType = ctx.match[2];
      await this.handleCategorySelection(ctx, shortId, categoryType);
    });

    // 处理分类取消
    this.bot.action(/^cc:(.+)$/, async (ctx) => {
      const shortId = ctx.match[1];
      await this.handleCategoryCancel(ctx, shortId);
    });
    
    this.logger.debug('Action handlers setup complete in CategorizationCommandHandler');
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

  // 获取完整商户ID
  getFullMerchantId(shortId: string): string | undefined {
    return this.truncatedIdMap.get(shortId);
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
        this.activeCategorizations.add(chatId);
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
    this.logger.debug(`Message received from chat ID: ${chatId}`);
    
    if (!chatId || !ctx.message || !('text' in ctx.message)) {
      this.logger.debug(`Skipping message: Invalid message format or missing chat ID`);
      return;
    }

    if (this.activeCategorizations.has(chatId)) {
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
    this.activeCategorizations.delete(chatId);
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
    this.activeCategorizations.delete(chatId);
    this.categorizationMap.delete(shortId);
  }
} 