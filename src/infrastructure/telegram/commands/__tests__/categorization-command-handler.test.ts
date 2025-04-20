import { Telegraf } from 'telegraf';
import { CategorizationCommandHandler } from '../categorization-command-handler';
import { container } from '../../../utils';
import { NLPService } from '../../../../domain/services/nlp.service';
import { ApplicationEventEmitter } from '../../../events/event-emitter';
import { Logger } from '../../../utils';
import { MESSAGES } from '../categorization-constants';
import { EventTypes } from '../../../events/event-types';

// Mock dependencies
jest.mock('telegraf');
jest.mock('../../../utils', () => ({
  container: {
    getByClass: jest.fn()
  }
}));

describe('CategorizationCommandHandler', () => {
  let handler: CategorizationCommandHandler;
  let mockBot: jest.Mocked<Telegraf>;
  let mockNlpService: jest.Mocked<NLPService>;
  let mockEventEmitter: jest.Mocked<ApplicationEventEmitter>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock implementations
    const mockSendMessage = jest.fn();
    mockBot = {
      telegram: {
        sendMessage: mockSendMessage
      },
      action: jest.fn().mockReturnThis()
    } as unknown as jest.Mocked<Telegraf>;
    
    mockNlpService = {
      categorizeMerchant: jest.fn()
    } as unknown as jest.Mocked<NLPService>;
    
    mockEventEmitter = {
      emit: jest.fn()
    } as unknown as jest.Mocked<ApplicationEventEmitter>;
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    // Setup container mock
    (container.getByClass as jest.Mock).mockImplementation((classType) => {
      if (classType === NLPService) return mockNlpService;
      if (classType === ApplicationEventEmitter) return mockEventEmitter;
      if (classType === Logger) return mockLogger;
      return null;
    });

    // Create handler instance
    handler = new CategorizationCommandHandler(mockBot);
  });

  describe('sendNotification', () => {
    it('should send a notification with correct keyboard when merchantId is provided', async () => {
      // Arrange
      const chatId = '123456';
      const message = 'Test message';
      const merchantId = 'merchant123';
      const categorizationData = {
        merchantId: 'merchant123',
        merchant: 'Test Merchant',
        chatId: '123456',
        timestamp: new Date().toISOString()
      };

      // Mock bot.telegram.sendMessage
      (mockBot.telegram.sendMessage as jest.Mock).mockResolvedValue(undefined);

      // Act
      await handler.sendNotification(chatId, message, merchantId, categorizationData);

      // Assert
      expect(mockBot.telegram.sendMessage).toHaveBeenCalled();
      expect(handler.getPendingCategorization(merchantId)).toBeDefined();
    });

    it('should handle errors when sending notification fails', async () => {
      // Arrange
      const chatId = '123456';
      const message = 'Test message';
      const error = new Error('Send message failed');
      (mockBot.telegram.sendMessage as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(handler.sendNotification(chatId, message)).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('handleCategorizeMerchantCallback', () => {
    it('should handle valid merchant categorization request', async () => {
      // Arrange
      const ctx = {
        chat: { id: '123456' },
        answerCbQuery: jest.fn(),
        reply: jest.fn()
      } as any;

      const truncatedId = 'abc123';
      const fullMerchantId = 'merchant123';
      
      // Add pending categorization
      handler.addTruncatedIdMapping(truncatedId, fullMerchantId);
      handler['pendingCategorizations'].set(fullMerchantId, {
        merchantId: fullMerchantId,
        merchant: 'Test Merchant',
        chatId: '123456',
        timestamp: new Date().toISOString()
      });

      // Act
      await handler.handleCategorizeMerchantCallback(ctx, truncatedId);

      // Assert
      expect(ctx.answerCbQuery).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalled();
      expect(handler['activeCategorizations'].has('123456')).toBe(true);
    });
  });

  describe('processCategorizationRequest', () => {
    it('should process categorization request successfully', async () => {
      // Arrange
      const ctx = {
        reply: jest.fn()
      } as any;

      const pendingCategorization = {
        merchantId: 'merchant123',
        merchant: 'Test Merchant',
        chatId: '123456',
        timestamp: new Date().toISOString()
      };

      const userInput = 'This is a coffee shop';
      const mockCategories = {
        primaryCategory: 'Food & Dining',
        alternativeCategory: 'Coffee Shops',
        suggestedNewCategory: 'Cafes'
      };

      // Mock NLP service response
      (mockNlpService.categorizeMerchant as jest.Mock).mockResolvedValue(mockCategories);

      // Act
      await handler['processCategorizationRequest'](ctx, pendingCategorization, userInput);

      // Assert
      expect(ctx.reply).toHaveBeenCalledWith(MESSAGES.ANALYZING);
      expect(mockNlpService.categorizeMerchant).toHaveBeenCalledWith(
        pendingCategorization.merchant,
        userInput
      );
      expect(ctx.reply).toHaveBeenCalledTimes(2); // Once for ANALYZING, once for result
      expect(handler['categorizationMap'].size).toBe(1);
    });

    it('should handle errors during categorization processing', async () => {
      // Arrange
      const ctx = {
        reply: jest.fn()
      } as any;

      const pendingCategorization = {
        merchantId: 'merchant123',
        merchant: 'Test Merchant',
        chatId: '123456',
        timestamp: new Date().toISOString()
      };

      const userInput = 'This is a coffee shop';
      const error = new Error('NLP service error');

      // Mock NLP service error
      (mockNlpService.categorizeMerchant as jest.Mock).mockRejectedValue(error);

      // Act
      await handler['processCategorizationRequest'](ctx, pendingCategorization, userInput);

      // Assert
      expect(ctx.reply).toHaveBeenCalledWith(MESSAGES.ANALYZING);
      expect(mockLogger.error).toHaveBeenCalledWith('Error processing categorization:', error);
      expect(ctx.reply).toHaveBeenCalledWith(MESSAGES.CATEGORIZATION_ERROR);
    });
  });

  describe('handleCategorySelection', () => {
    it('should handle category selection successfully', async () => {
      // Arrange
      const ctx = {
        chat: { id: '123456' },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn()
      } as any;

      const shortId = 'abc123';
      const categoryType = 'primary';
      const merchantId = 'merchant123';
      const selectedCategory = 'Food & Dining';

      // Setup categorization data
      handler['categorizationMap'].set(shortId, {
        merchantId: merchantId,
        categories: {
          primary: selectedCategory,
          alternative: 'Coffee Shops',
          suggested: 'Cafes'
        }
      });

      // Setup pending categorization
      handler['pendingCategorizations'].set(merchantId, {
        merchantId: merchantId,
        merchant: 'Test Merchant',
        chatId: '123456',
        timestamp: new Date().toISOString()
      });

      // Act
      await handler.handleCategorySelection(ctx, shortId, categoryType);

      // Assert
      expect(ctx.answerCbQuery).not.toHaveBeenCalled(); // Should not be called on success
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(EventTypes.MERCHANT_CATEGORY_SELECTED, expect.any(Object));
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        MESSAGES.CATEGORY_SELECTED('Test Merchant', selectedCategory)
      );
      expect(handler['pendingCategorizations'].has(merchantId)).toBe(false);
      expect(handler['activeCategorizations'].has('123456')).toBe(false);
      expect(handler['categorizationMap'].has(shortId)).toBe(false);
    });

    it('should handle missing chat ID', async () => {
      // Arrange
      const ctx = {
        answerCbQuery: jest.fn()
      } as any;

      const shortId = 'abc123';
      const categoryType = 'primary';

      // Act
      await handler.handleCategorySelection(ctx, shortId, categoryType);

      // Assert
      expect(ctx.answerCbQuery).toHaveBeenCalledWith(MESSAGES.ERROR_CHAT_ID_NOT_FOUND);
    });

    it('should handle missing categorization data', async () => {
      // Arrange
      const ctx = {
        chat: { id: '123456' },
        answerCbQuery: jest.fn()
      } as any;

      const shortId = 'abc123';
      const categoryType = 'primary';

      // Act
      await handler.handleCategorySelection(ctx, shortId, categoryType);

      // Assert
      expect(ctx.answerCbQuery).toHaveBeenCalledWith(MESSAGES.ERROR_CATEGORIZATION_NOT_FOUND);
    });
  });
}); 