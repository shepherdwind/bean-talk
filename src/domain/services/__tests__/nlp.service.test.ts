jest.mock('../../../infrastructure/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../infrastructure/utils/container', () => ({
  container: {
    getByClass: jest.fn(),
  },
}));

// Mock merchant-category-mapping to avoid file I/O
jest.mock('../../models/merchant-category-mapping', () => ({
  get merchantCategoryMappings() { return {}; },
  findCategoryForMerchant: jest.fn(),
  addMerchantToMapping: jest.fn(),
  updateMerchantCategoryMappingsIfNeeded: jest.fn(),
}));

import { NLPService } from '../nlp.service';
import { OpenAIAdapter } from '../../../infrastructure/openai/openai.adapter';
import { AccountingService } from '../accounting.service';
import { AccountName } from '../../models/account';

describe('NLPService', () => {
  let service: NLPService;
  let mockOpenAI: jest.Mocked<OpenAIAdapter>;
  let mockAccounting: jest.Mocked<AccountingService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAI = {
      processMessage: jest.fn(),
    } as unknown as jest.Mocked<OpenAIAdapter>;
    mockAccounting = {
      getAllAccountNames: jest.fn().mockReturnValue(Object.values(AccountName)),
    } as unknown as jest.Mocked<AccountingService>;
    service = new NLPService(mockOpenAI, mockAccounting);
  });

  describe('categorizeMerchant', () => {
    it('should parse three category options from response', async () => {
      mockOpenAI.processMessage.mockResolvedValue(
        '1. Primary Category: Expenses:Food:Dining\n' +
        '2. Alternative Category: Expenses:Food\n' +
        '3. Suggested New Category: Expenses:Food:Delivery'
      );

      const result = await service.categorizeMerchant('GRAB FOOD', 'food app');
      expect(result).toEqual({
        primaryCategory: 'Expenses:Food:Dining',
        alternativeCategory: 'Expenses:Food',
        suggestedNewCategory: 'Expenses:Food:Delivery',
      });

      // Verify prompt contains merchant and additional info
      const prompt = mockOpenAI.processMessage.mock.calls[0][0];
      expect(prompt).toContain('GRAB FOOD');
      expect(prompt).toContain('food app');
    });

    it('should throw when OpenAI fails', async () => {
      mockOpenAI.processMessage.mockRejectedValue(new Error('API error'));
      await expect(service.categorizeMerchant('M', 'info')).rejects.toThrow('API error');
    });
  });

  describe('autoCategorizeMerchant', () => {
    it('should parse JSON response with category and confidence', async () => {
      mockOpenAI.processMessage.mockResolvedValue(
        '{"category": "Expenses:Food:Dining", "confidence": 0.95}'
      );

      const result = await service.autoCategorizeMerchant('GRAB FOOD');
      expect(result).toEqual({
        category: 'Expenses:Food:Dining',
        confidence: 0.95,
      });
    });

    it('should handle JSON embedded in other text', async () => {
      mockOpenAI.processMessage.mockResolvedValue(
        'Here is the result: {"category": "Expenses:Food", "confidence": 0.8} end'
      );

      const result = await service.autoCategorizeMerchant('GRAB');
      expect(result.category).toBe('Expenses:Food');
      expect(result.confidence).toBe(0.8);
    });

    it('should return safe defaults when no JSON found', async () => {
      mockOpenAI.processMessage.mockResolvedValue('No valid response');

      const result = await service.autoCategorizeMerchant('UNKNOWN');
      expect(result).toEqual({ category: '', confidence: 0 });
    });

    it('should return safe defaults on API error', async () => {
      mockOpenAI.processMessage.mockRejectedValue(new Error('timeout'));

      const result = await service.autoCategorizeMerchant('M');
      expect(result).toEqual({ category: '', confidence: 0 });
    });

    it('should handle missing category or non-numeric confidence', async () => {
      mockOpenAI.processMessage.mockResolvedValue(
        '{"confidence": "high"}'
      );

      const result = await service.autoCategorizeMerchant('M');
      expect(result).toEqual({ category: '', confidence: 0 });
    });

    it('should only include expense accounts in prompt', async () => {
      mockOpenAI.processMessage.mockResolvedValue(
        '{"category": "Expenses:Food", "confidence": 0.9}'
      );

      await service.autoCategorizeMerchant('GRAB');
      const prompt = mockOpenAI.processMessage.mock.calls[0][0];
      // Should contain expense accounts
      expect(prompt).toContain('Expenses:Food');
      // Should NOT contain asset accounts
      expect(prompt).not.toContain('Assets:DBS');
    });
  });

  describe('parseExpenseInput', () => {
    it('should parse JSON response into expense data', async () => {
      mockOpenAI.processMessage.mockResolvedValue(
        '{"amount": 50, "currency": "SGD", "description": "lunch", "category": "Expenses:Food"}'
      );

      const result = await service.parseExpenseInput('lunch 50 sgd');
      expect(result).toEqual({
        amount: 50,
        currency: 'SGD',
        description: 'lunch',
        category: 'Expenses:Food',
      });
    });

    it('should throw on API error', async () => {
      mockOpenAI.processMessage.mockRejectedValue(new Error('API error'));
      await expect(service.parseExpenseInput('bad')).rejects.toThrow('API error');
    });

    it('should throw on invalid JSON response', async () => {
      mockOpenAI.processMessage.mockResolvedValue('not json');
      await expect(service.parseExpenseInput('test')).rejects.toThrow();
    });
  });

  describe('parseDateRange', () => {
    it('should parse valid date range response', async () => {
      mockOpenAI.processMessage.mockResolvedValue(
        '{"startDate": "2024-03-15T00:00:00.000+08:00", "endDate": "2024-03-15T23:59:59.999+08:00"}'
      );

      const result = await service.parseDateRange('yesterday');
      expect(result).not.toBeNull();
      expect(result!.startDate).toBeInstanceOf(Date);
      expect(result!.endDate).toBeInstanceOf(Date);
    });

    it('should return null on empty response', async () => {
      mockOpenAI.processMessage.mockResolvedValue('');
      const result = await service.parseDateRange('blah');
      expect(result).toBeNull();
    });

    it('should return null when no JSON found', async () => {
      mockOpenAI.processMessage.mockResolvedValue('I cannot parse this');
      const result = await service.parseDateRange('blah');
      expect(result).toBeNull();
    });

    it('should return null when startDate is missing', async () => {
      mockOpenAI.processMessage.mockResolvedValue(
        '{"endDate": "2024-03-15T23:59:59.999+08:00"}'
      );
      const result = await service.parseDateRange('test');
      expect(result).toBeNull();
    });

    it('should return null when endDate is missing', async () => {
      mockOpenAI.processMessage.mockResolvedValue(
        '{"startDate": "2024-03-15T00:00:00.000+08:00"}'
      );
      const result = await service.parseDateRange('test');
      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockOpenAI.processMessage.mockRejectedValue(new Error('timeout'));
      const result = await service.parseDateRange('test');
      expect(result).toBeNull();
    });

    it('should add one day to endDate', async () => {
      mockOpenAI.processMessage.mockResolvedValue(
        '{"startDate": "2024-03-15T00:00:00.000+08:00", "endDate": "2024-03-15T23:59:59.999+08:00"}'
      );

      const result = await service.parseDateRange('yesterday');
      // endDate should be March 16 (original March 15 + 1 day)
      expect(result!.endDate.getDate()).toBe(
        new Date('2024-03-15T23:59:59.999+08:00').getDate() + 1
      );
    });

    it('should handle JSON embedded in other text', async () => {
      mockOpenAI.processMessage.mockResolvedValue(
        'The date range is: {"startDate": "2024-03-15T00:00:00.000+08:00", "endDate": "2024-03-15T23:59:59.999+08:00"} hope that helps!'
      );

      const result = await service.parseDateRange('yesterday');
      expect(result).not.toBeNull();
    });
  });
});
