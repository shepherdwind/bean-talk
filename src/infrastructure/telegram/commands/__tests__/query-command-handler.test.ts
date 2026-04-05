jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  Logger: jest.fn(),
}));

const mockQueryByDateRange = jest.fn().mockResolvedValue({
  assets: [],
  expenses: [],
});

jest.mock('../../../utils/container', () => ({
  container: {
    getByClass: jest.fn().mockReturnValue({
      queryByDateRange: mockQueryByDateRange,
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

jest.mock('../../../utils/query-result-formatter', () => ({
  formatQueryResult: jest.fn().mockReturnValue('Formatted result'),
}));

// Mock merchant-category-mapping
jest.mock('../../../../domain/models/merchant-category-mapping', () => ({
  get merchantCategoryMappings() { return {}; },
  findCategoryForMerchant: jest.fn(),
  addMerchantToMapping: jest.fn(),
  updateMerchantCategoryMappingsIfNeeded: jest.fn(),
}));

import { QueryCommandHandler, TimeRange } from '../query-command-handler';
import { Bot } from 'grammy';
import { BotContext } from '../../grammy-types';

describe('QueryCommandHandler', () => {
  let handler: QueryCommandHandler;
  let mockBot: Bot<BotContext>;
  let mockCtx: Partial<BotContext>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBot = {
      callbackQuery: jest.fn(),
    } as unknown as Bot<BotContext>;

    mockCtx = {
      reply: jest.fn().mockResolvedValue(undefined),
      answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
    };

    handler = new QueryCommandHandler(mockBot);
  });

  describe('handle', () => {
    it('should reply with inline keyboard', async () => {
      await handler.handle(mockCtx as BotContext);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Please select a time range:',
        expect.objectContaining({ reply_markup: expect.anything() })
      );
    });
  });

  describe('registerCallbackHandlers', () => {
    it('should register callback handler on bot', () => {
      handler.registerCallbackHandlers();
      expect(mockBot.callbackQuery).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should handle callback with time range data', async () => {
      handler.registerCallbackHandlers();
      // Get the registered callback function
      const callback = (mockBot.callbackQuery as jest.Mock).mock.calls[0][1];

      const callbackCtx = {
        callbackQuery: { data: TimeRange.TODAY },
        reply: jest.fn().mockResolvedValue(undefined),
        answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      };

      await callback(callbackCtx);
      expect(callbackCtx.answerCallbackQuery).toHaveBeenCalled();
      expect(callbackCtx.reply).toHaveBeenCalled();
    });

    it('should handle callback error', async () => {
      handler.registerCallbackHandlers();
      const callback = (mockBot.callbackQuery as jest.Mock).mock.calls[0][1];

      mockQueryByDateRange.mockRejectedValueOnce(new Error('DB error'));

      const callbackCtx = {
        callbackQuery: { data: TimeRange.TODAY },
        reply: jest.fn().mockResolvedValue(undefined),
        answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
      };

      await callback(callbackCtx);
      expect(callbackCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('error')
      );
    });
  });

  describe('time range handlers', () => {
    it('should process today query', async () => {
      await (handler as any).handleToday(mockCtx);
      expect(mockCtx.reply).toHaveBeenCalledTimes(2); // "Querying..." + result
      expect(mockQueryByDateRange).toHaveBeenCalled();
    });

    it('should process yesterday query', async () => {
      await (handler as any).handleYesterday(mockCtx);
      expect(mockQueryByDateRange).toHaveBeenCalled();
    });

    it('should process this week query', async () => {
      await (handler as any).handleThisWeek(mockCtx);
      expect(mockQueryByDateRange).toHaveBeenCalled();
    });

    it('should process last week query', async () => {
      await (handler as any).handleLastWeek(mockCtx);
      expect(mockQueryByDateRange).toHaveBeenCalled();
    });

    it('should process this month query', async () => {
      await (handler as any).handleThisMonth(mockCtx);
      expect(mockQueryByDateRange).toHaveBeenCalled();
    });

    it('should process last month query', async () => {
      await (handler as any).handleLastMonth(mockCtx);
      expect(mockQueryByDateRange).toHaveBeenCalled();
    });

    it('should handle query error', async () => {
      mockQueryByDateRange.mockRejectedValueOnce(new Error('Query failed'));
      await (handler as any).handleToday(mockCtx);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('error')
      );
    });
  });
});
