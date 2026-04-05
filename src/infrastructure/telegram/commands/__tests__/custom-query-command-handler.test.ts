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

const mockParseDateRange = jest.fn();

jest.mock('../../../utils/container', () => ({
  container: {
    getByClass: jest.fn().mockImplementation((cls: { name: string }) => {
      if (cls.name === 'NLPService') {
        return { parseDateRange: mockParseDateRange };
      }
      if (cls.name === 'BeancountQueryService') {
        return { queryByDateRange: mockQueryByDateRange };
      }
      // Logger
      return {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };
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

import { CustomQueryCommandHandler } from '../custom-query-command-handler';
import { Bot } from 'grammy';
import { BotContext } from '../../grammy-types';

describe('CustomQueryCommandHandler', () => {
  let handler: CustomQueryCommandHandler;
  let mockBot: Bot<BotContext>;
  let mockCtx: Partial<BotContext>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBot = {} as Bot<BotContext>;
    mockCtx = {
      message: { text: '查昨天' } as any,
      from: { id: 123 } as any,
      reply: jest.fn().mockResolvedValue(undefined),
    };

    handler = new CustomQueryCommandHandler(mockBot);
  });

  describe('handle', () => {
    it('should return false for non-查 messages', async () => {
      const ctx = { ...mockCtx, message: { text: 'hello' } as any } as BotContext;
      const result = await handler.handle(ctx);
      expect(result).toBe(false);
    });

    it('should return false for empty text', async () => {
      const ctx = { ...mockCtx, message: undefined } as unknown as BotContext;
      const result = await handler.handle(ctx);
      expect(result).toBe(false);
    });

    it('should return false when no userId', async () => {
      const ctx = { ...mockCtx, from: undefined } as unknown as BotContext;
      const result = await handler.handle(ctx);
      expect(result).toBe(false);
    });

    it('should process query starting with 查', async () => {
      mockParseDateRange.mockResolvedValue({
        startDate: new Date('2024-03-14'),
        endDate: new Date('2024-03-15'),
      });

      const result = await handler.handle(mockCtx as BotContext);
      expect(result).toBe(true);
      expect(mockQueryByDateRange).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(
        'Formatted result',
        { parse_mode: 'HTML' }
      );
    });

    it('should show error when NLP cannot parse date', async () => {
      mockParseDateRange.mockResolvedValue(null);

      const result = await handler.handle(mockCtx as BotContext);
      expect(result).toBe(true);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining("couldn't understand")
      );
    });

    it('should handle query error gracefully', async () => {
      mockParseDateRange.mockRejectedValue(new Error('NLP error'));

      const result = await handler.handle(mockCtx as BotContext);
      expect(result).toBe(true);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('error')
      );
    });
  });
});
