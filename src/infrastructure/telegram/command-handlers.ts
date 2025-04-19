import { Context } from 'telegraf';
import { ILogger, container, Logger } from '../utils';
import { NLPService } from '../../domain/services/nlp.service';
import { PendingCategorization } from './types';
import { Telegraf } from 'telegraf';
import { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { ApplicationEventEmitter } from '../events/event-emitter';

export class CommandHandlers {
  private logger: ILogger;
  private nlpService: NLPService;
  private pendingCategorizations: Map<string, PendingCategorization>;
  private bot: Telegraf;
  private activeCategorizations: Set<string> = new Set();
  private eventEmitter: ApplicationEventEmitter;
  private categorizationMap: Map<string, { merchantId: string; categories: { primary: string; alternative: string; suggested: string } }> = new Map();

  constructor(bot: Telegraf, pendingCategorizations: Map<string, PendingCategorization>) {
    this.logger = container.getByClass(Logger);
    this.nlpService = container.getByClass(NLPService);
    this.pendingCategorizations = pendingCategorizations;
    this.bot = bot;
    this.eventEmitter = container.getByClass(ApplicationEventEmitter);
    
    this.logger.debug('Initializing CommandHandlers');
    this.logger.debug(`Bot instance: ${this.bot ? 'Valid' : 'Invalid'}`);
    
    this.setupMessageHandler();
    this.setupCallbackQueryHandler();
    
    this.logger.debug('CommandHandlers initialization complete');
  }

  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 8);
  }

  private setupMessageHandler(): void {
    this.logger.debug('Setting up message handler in CommandHandlers');
    
    // We can't remove existing listeners in Telegraf, so we'll just add our handler
    // The last registered handler will take precedence
    
    this.bot.on('message', async (ctx) => {
      const chatId = ctx.chat?.id.toString();
      this.logger.debug(`Message received from chat ID: ${chatId}`);
      
      if (!chatId || !ctx.message || !('text' in ctx.message)) {
        this.logger.debug(`Skipping message: Invalid message format or missing chat ID`);
        return;
      }

      // Check if this chat has an active categorization
      this.logger.debug(`Active categorizations: ${Array.from(this.activeCategorizations).join(', ')}`);
      this.logger.debug(`Is chat ${chatId} in active categorizations? ${this.activeCategorizations.has(chatId)}`);
      
      if (this.activeCategorizations.has(chatId)) {
        this.logger.debug(`Processing message for active categorization in chat ${chatId}`);
        
        // Find the pending categorization by checking all entries in the map
        const pendingCategorization = Array.from(this.pendingCategorizations.entries())
          .find(([merchantId, cat]) => cat.chatId === chatId)?.[1];
        
        this.logger.debug(`Pending categorizations: ${Array.from(this.pendingCategorizations.keys()).join(', ')}`);
        this.logger.debug(`Found pending categorization for chat ${chatId}: ${pendingCategorization ? 'Yes' : 'No'}`);
        
        if (pendingCategorization) {
          this.logger.debug(`Processing categorization request for merchant: ${pendingCategorization.merchant}`);
          await this.processCategorizationRequest(ctx, pendingCategorization, ctx.message.text);
          // Don't remove the chat ID or pending categorization here
          // They will be removed when the user selects a category or cancels
          this.logger.debug(`Categorization request processed for chat ${chatId}`);
        } else {
          this.logger.debug(`No pending categorization found for chat ${chatId}, but chat is in activeCategorizations`);
        }
      } else {
        this.logger.debug(`Chat ${chatId} is not in active categorizations, skipping message processing`);
      }
    });
    
    this.logger.debug('Message handler setup complete in CommandHandlers');
  }

  private setupCallbackQueryHandler(): void {
    this.bot.action(/^sc:(.+):(.+)$/, async (ctx) => {
      const shortId = ctx.match[1];
      const categoryType = ctx.match[2];
      const chatId = ctx.chat?.id.toString();
      
      if (!chatId) {
        await ctx.answerCbQuery('Error: Chat ID not found');
        return;
      }

      const categorizationData = this.categorizationMap.get(shortId);
      if (!categorizationData) {
        await ctx.answerCbQuery('Error: Categorization request not found');
        return;
      }

      const { merchantId, categories } = categorizationData;
      const selectedCategory = categories[categoryType as keyof typeof categories];
      if (!selectedCategory) {
        await ctx.answerCbQuery('Error: Invalid category type');
        return;
      }

      const pendingCategorization = this.pendingCategorizations.get(merchantId);
      if (!pendingCategorization) {
        await ctx.answerCbQuery('Error: Categorization request not found');
        return;
      }

      // Emit event for category selection
      this.eventEmitter.emit('merchantCategorySelected', {
        merchantId: pendingCategorization.merchantId,
        merchant: pendingCategorization.merchant,
        selectedCategory: selectedCategory,
        timestamp: new Date().toISOString()
      });

      await ctx.editMessageText(
        `✅ Selected category for "${pendingCategorization.merchant}":\n` +
        `📁 ${selectedCategory}\n\n` +
        `The category has been saved and will be used for future transactions from this merchant.`
      );

      // Clean up all related data
      this.pendingCategorizations.delete(merchantId);
      this.activeCategorizations.delete(chatId);
      this.categorizationMap.delete(shortId);
    });

    this.bot.action(/^cc:(.+)$/, async (ctx) => {
      const shortId = ctx.match[1];
      const chatId = ctx.chat?.id.toString();
      
      if (!chatId) {
        await ctx.answerCbQuery('Error: Chat ID not found');
        return;
      }

      const categorizationData = this.categorizationMap.get(shortId);
      if (!categorizationData) {
        await ctx.answerCbQuery('Error: Categorization request not found');
        return;
      }

      const { merchantId } = categorizationData;
      const pendingCategorization = this.pendingCategorizations.get(merchantId);
      if (!pendingCategorization) {
        await ctx.answerCbQuery('Error: Categorization request not found');
        return;
      }

      await ctx.editMessageText('❌ Categorization cancelled.');
      
      // Clean up all related data
      this.pendingCategorizations.delete(merchantId);
      this.activeCategorizations.delete(chatId);
      this.categorizationMap.delete(shortId);
    });
  }

  async handleStart(ctx: Context): Promise<void> {
    await ctx.reply('Welcome to BeanTalk! Your personal finance assistant.');
  }

  async handleCategorizeMerchant(ctx: Context, merchantId: string): Promise<void> {
    const pendingCategorization = this.pendingCategorizations.get(merchantId);
    
    if (!pendingCategorization) {
      await ctx.reply('❌ Sorry, this categorization request has expired or is invalid.');
      return;
    }

    try {
      await ctx.answerCbQuery();
      await ctx.reply(
        `🤖 I'll help you categorize "${pendingCategorization.merchant}".\n\n` +
        `Please provide any additional information about this merchant that might help with categorization.\n` +
        `For example:\n` +
        `- What type of business is it?\n` +
        `- What did you purchase?\n` +
        `- Any specific details about the transaction?\n\n` +
        `Just type your response and I'll analyze it.`
      );

      // Mark this chat as having an active categorization
      if (ctx.chat?.id) {
        const chatId = ctx.chat.id.toString();
        this.activeCategorizations.add(chatId);
        // Update the pendingCategorization with the chatId
        pendingCategorization.chatId = chatId;
        this.pendingCategorizations.set(merchantId, pendingCategorization);
      }
    } catch (error) {
      this.logger.error('Error handling AI categorization:', error);
      await ctx.reply('❌ Sorry, there was an error processing your request.');
    }
  }

  private async processCategorizationRequest(ctx: Context, pendingCategorization: PendingCategorization, userInput: string): Promise<void> {
    try {
      await ctx.reply('🤖 Analyzing the information...');
      this.logger.debug(`Starting AI analysis for merchant: ${pendingCategorization.merchant}`);
      this.logger.debug(`User input: ${userInput}`);

      const categories = await this.nlpService.categorizeMerchant(pendingCategorization.merchant, userInput);
      this.logger.debug('AI analysis results:', {
        primaryCategory: categories.primaryCategory,
        alternativeCategory: categories.alternativeCategory,
        suggestedNewCategory: categories.suggestedNewCategory
      });
      
      // Generate a short ID for this categorization
      const shortId = this.generateShortId();
      this.categorizationMap.set(shortId, {
        merchantId: pendingCategorization.merchantId,
        categories: {
          primary: categories.primaryCategory,
          alternative: categories.alternativeCategory,
          suggested: categories.suggestedNewCategory
        }
      });
      
      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: `📁 ${categories.primaryCategory}`, callback_data: `sc:${shortId}:primary` }
          ],
          [
            { text: `📁 ${categories.alternativeCategory}`, callback_data: `sc:${shortId}:alternative` }
          ],
          [
            { text: `📁 ${categories.suggestedNewCategory}`, callback_data: `sc:${shortId}:suggested` }
          ],
          [
            { text: '❌ Cancel', callback_data: `cc:${shortId}` }
          ]
        ]
      };

      this.logger.debug('Generated keyboard:', JSON.stringify(keyboard, null, 2));

      await ctx.reply(
        `I've analyzed "${pendingCategorization.merchant}" and found these possible categories:\n\n` +
        `1. ${categories.primaryCategory}\n` +
        `2. ${categories.alternativeCategory}\n` +
        `3. ${categories.suggestedNewCategory}\n\n` +
        `Please select the most appropriate category:`,
        { reply_markup: keyboard }
      );
    } catch (error) {
      this.logger.error('Error processing categorization:', error);
      this.logger.error('Error details:', {
        merchant: pendingCategorization.merchant,
        merchantId: pendingCategorization.merchantId,
        userInput: userInput,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      await ctx.reply('❌ Sorry, there was an error processing the categorization.');
    }
  }
} 