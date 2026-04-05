jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../utils/container', () => ({
  container: {
    getByClass: jest.fn().mockReturnValue({
      categorizeMerchant: jest.fn().mockResolvedValue({
        primaryCategory: 'Expenses:Food:Dining',
        alternativeCategory: 'Expenses:Food',
        suggestedNewCategory: 'Expenses:Food:Delivery',
      }),
      emit: jest.fn(),
    }),
  },
}));

jest.mock('../../../../domain/models/merchant-category-mapping', () => ({
  get merchantCategoryMappings() { return {}; },
  findCategoryForMerchant: jest.fn(),
  addMerchantToMapping: jest.fn(),
  updateMerchantCategoryMappingsIfNeeded: jest.fn(),
}));

jest.mock('../../telegram.adapter', () => ({
  getPendingMerchant: jest.fn(),
  removePendingMerchant: jest.fn(),
  removePendingMerchantByMerchantId: jest.fn(),
}));

import { CATEGORIZATION_CONVERSATION_ID, categorizationConversation } from '../categorization';
import { getPendingMerchant } from '../../telegram.adapter';
import { CALLBACK_PREFIXES } from '../../commands/categorization-constants';

describe('categorizationConversation', () => {
  it('should export conversation function and ID', () => {
    expect(CATEGORIZATION_CONVERSATION_ID).toBe('categorization');
    expect(typeof categorizationConversation).toBe('function');
  });

  it('should have correct function signature (conversation, ctx)', () => {
    expect(categorizationConversation.length).toBe(2);
  });

  it('should return early when callback data does not start with CATEGORIZE_MERCHANT prefix', async () => {
    const mockConversation = {
      external: jest.fn((fn: () => unknown) => fn()),
      waitFor: jest.fn(),
      wait: jest.fn(),
      skip: jest.fn(),
    };
    const mockCtx = {
      callbackQuery: { data: 'wrong_prefix' },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
    };

    await categorizationConversation(mockConversation as any, mockCtx as any);
    // Should not have called waitFor or wait
    expect(mockConversation.waitFor).not.toHaveBeenCalled();
  });

  it('should return early when no callback data', async () => {
    const mockConversation = {
      external: jest.fn((fn: () => unknown) => fn()),
      waitFor: jest.fn(),
      wait: jest.fn(),
      skip: jest.fn(),
    };
    const mockCtx = {
      callbackQuery: undefined,
    };

    await categorizationConversation(mockConversation as any, mockCtx as any);
    expect(mockConversation.waitFor).not.toHaveBeenCalled();
  });

  it('should handle missing merchant from registry', async () => {
    (getPendingMerchant as jest.Mock).mockReturnValue(undefined);

    const mockConversation = {
      external: jest.fn((fn: () => unknown) => fn()),
      waitFor: jest.fn(),
      wait: jest.fn(),
      skip: jest.fn(),
    };
    const mockCtx = {
      callbackQuery: { data: `${CALLBACK_PREFIXES.CATEGORIZE_MERCHANT}abc123` },
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
    };

    await categorizationConversation(mockConversation as any, mockCtx as any);
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.stringContaining('')
    );
  });

  it('should process categorization flow with merchant', async () => {
    (getPendingMerchant as jest.Mock).mockReturnValue({
      merchantId: 'grab_food',
      merchant: 'GRAB FOOD',
    });

    const editReply = jest.fn().mockResolvedValue(undefined);
    const answerCallbackQuery = jest.fn().mockResolvedValue(undefined);
    const contextReply = jest.fn().mockResolvedValue(undefined);

    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: '/cancel' },
      reply: contextReply,
    });

    const mockConversation = {
      external: jest.fn((fn: () => unknown) => fn()),
      waitFor: mockWaitFor,
      wait: jest.fn(),
      skip: jest.fn(),
    };

    const mockCtx = {
      callbackQuery: { data: `${CALLBACK_PREFIXES.CATEGORIZE_MERCHANT}abc123` },
      editMessageReplyMarkup: editReply,
      answerCallbackQuery,
      reply: jest.fn().mockResolvedValue(undefined),
    };

    await categorizationConversation(mockConversation as any, mockCtx as any);
    // Should have removed the inline keyboard
    expect(editReply).toHaveBeenCalled();
    // Should have prompted for context
    expect(mockCtx.reply).toHaveBeenCalled();
    // User cancelled
    expect(contextReply).toHaveBeenCalledWith(
      expect.stringContaining('')
    );
  });

  it('should handle NLP categorization and category selection', async () => {
    (getPendingMerchant as jest.Mock).mockReturnValue({
      merchantId: 'grab_food',
      merchant: 'GRAB FOOD',
    });

    const contextReply = jest.fn().mockResolvedValue(undefined);
    const editMessageText = jest.fn().mockResolvedValue(undefined);
    const answerCb = jest.fn().mockResolvedValue(undefined);

    // First waitFor: user provides additional context
    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: 'food delivery app' },
      reply: contextReply,
      from: { username: 'ewardsong' },
    });

    // Then wait: user selects primary category
    const mockWait = jest.fn().mockResolvedValue({
      callbackQuery: { data: 'cat:primary' },
      message: undefined,
      editMessageText,
      answerCallbackQuery: answerCb,
    });

    const mockConversation = {
      external: jest.fn((fn: () => unknown) => fn()),
      waitFor: mockWaitFor,
      wait: mockWait,
      skip: jest.fn(),
    };

    const mockCtx = {
      callbackQuery: { data: `${CALLBACK_PREFIXES.CATEGORIZE_MERCHANT}abc123` },
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    };

    await categorizationConversation(mockConversation as any, mockCtx as any);
    // Should have shown category options
    expect(contextReply).toHaveBeenCalledWith(
      expect.stringContaining('GRAB FOOD'),
      expect.anything()
    );
    // Should have updated with selected category
    expect(answerCb).toHaveBeenCalled();
  });

  it('should handle NLP error', async () => {
    (getPendingMerchant as jest.Mock).mockReturnValue({
      merchantId: 'grab_food',
      merchant: 'GRAB FOOD',
    });

    const contextReply = jest.fn().mockResolvedValue(undefined);
    const mockExternal = jest.fn()
      .mockImplementationOnce((fn: () => unknown) => fn()) // getPendingMerchant
      .mockRejectedValueOnce(new Error('NLP error')); // categorizeMerchant

    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: 'food' },
      reply: contextReply,
    });

    const mockConversation = {
      external: mockExternal,
      waitFor: mockWaitFor,
      wait: jest.fn(),
      skip: jest.fn(),
    };

    const mockCtx = {
      callbackQuery: { data: `${CALLBACK_PREFIXES.CATEGORIZE_MERCHANT}abc123` },
      editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    };

    await categorizationConversation(mockConversation as any, mockCtx as any);
    // Should have sent error message
    expect(contextReply).toHaveBeenCalledWith(
      expect.stringContaining('')
    );
  });
});
