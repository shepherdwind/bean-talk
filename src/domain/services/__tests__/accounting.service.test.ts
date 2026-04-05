// Mock merchant-category-mapping before importing
jest.mock('../../models/merchant-category-mapping', () => {
  const mappings: Record<string, string> = {
    'GRAB FOOD': 'Expenses:Food:Dining',
  };
  return {
    get merchantCategoryMappings() { return { ...mappings }; },
    findCategoryForMerchant: jest.fn((merchant: string) => mappings[merchant] || undefined),
    addMerchantToMapping: jest.fn(),
    updateMerchantCategoryMappingsIfNeeded: jest.fn(),
  };
});

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

import { AccountingService } from '../accounting.service';
import { AccountName } from '../../models/account';
import { AccountType, Currency } from '../../models/types';
import { Transaction } from '../../models/transaction';
import { BeancountService } from '../beancount.service';
import {
  findCategoryForMerchant,
  addMerchantToMapping,
} from '../../models/merchant-category-mapping';

describe('AccountingService', () => {
  let service: AccountingService;
  let mockBeancountService: jest.Mocked<BeancountService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBeancountService = {
      appendTransaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BeancountService>;
    service = new AccountingService(mockBeancountService);
  });

  describe('addTransaction', () => {
    const transaction: Transaction = {
      date: new Date('2024-03-15'),
      description: 'Test',
      entries: [
        { account: AccountName.AssetsDBSSGDSaving, amount: { value: -50, currency: Currency.SGD } },
        { account: AccountName.ExpensesFood, amount: { value: 50, currency: Currency.SGD } },
      ],
    };

    it('should delegate to BeancountService', async () => {
      await service.addTransaction(transaction);
      expect(mockBeancountService.appendTransaction).toHaveBeenCalledWith(transaction);
    });

    it('should throw when BeancountService fails', async () => {
      mockBeancountService.appendTransaction.mockRejectedValue(new Error('write failed'));
      await expect(service.addTransaction(transaction)).rejects.toThrow('write failed');
    });
  });

  describe('getAccountType', () => {
    it('should return Asset for Assets: prefix', () => {
      expect(service.getAccountType(AccountName.AssetsDBSSGDSaving)).toBe(AccountType.Asset);
    });

    it('should return Expense for Expenses: prefix', () => {
      expect(service.getAccountType(AccountName.ExpensesFood)).toBe(AccountType.Expense);
    });

    it('should return Income for Income: prefix', () => {
      expect(service.getAccountType(AccountName.IncomeSalary)).toBe(AccountType.Income);
    });

    it('should return Liability for Liabilities: prefix', () => {
      expect(service.getAccountType(AccountName.LiabilitiesLoanJihui)).toBe(AccountType.Liability);
    });

    it('should throw for unknown prefix', () => {
      expect(() => service.getAccountType('Unknown:Account' as AccountName)).toThrow(
        'Unknown account type for account: Unknown:Account'
      );
    });
  });

  describe('getAccountByName', () => {
    it('should return Account object with correct structure', () => {
      const account = service.getAccountByName(AccountName.ExpensesFood);
      expect(account).toEqual({
        name: AccountName.ExpensesFood,
        type: AccountType.Expense,
        openDate: '2011-10-10',
      });
    });
  });

  describe('getAccountsByType', () => {
    it('should return all accounts of given type', () => {
      const incomeAccounts = service.getAccountsByType(AccountType.Income);
      expect(incomeAccounts.length).toBeGreaterThan(0);
      incomeAccounts.forEach(acc => {
        expect(acc.type).toBe(AccountType.Income);
        expect(acc.name).toMatch(/^Income:/);
      });
    });

    it('should return empty array for type with no accounts', () => {
      const equityAccounts = service.getAccountsByType(AccountType.Equity);
      expect(equityAccounts).toEqual([]);
    });
  });

  describe('getAllAccountNames', () => {
    it('should return all AccountName enum values', () => {
      const names = service.getAllAccountNames();
      expect(names).toEqual(Object.values(AccountName));
      expect(names.length).toBeGreaterThan(0);
    });
  });

  describe('findCategoryForMerchant', () => {
    it('should delegate to merchant-category-mapping module', () => {
      const result = service.findCategoryForMerchant('GRAB FOOD');
      expect(findCategoryForMerchant).toHaveBeenCalledWith('GRAB FOOD');
      expect(result).toBe('Expenses:Food:Dining');
    });

    it('should return undefined when no match', () => {
      (findCategoryForMerchant as jest.Mock).mockReturnValueOnce(undefined);
      expect(service.findCategoryForMerchant('UNKNOWN')).toBeUndefined();
    });

    it('should return undefined and log error when delegate throws', () => {
      (findCategoryForMerchant as jest.Mock).mockImplementationOnce(() => {
        throw new Error('read error');
      });
      expect(service.findCategoryForMerchant('BAD')).toBeUndefined();
    });
  });

  describe('addMerchantToCategory', () => {
    it('should delegate to addMerchantToMapping with category', () => {
      service.addMerchantToCategory('NEW', 'Expenses:Food');
      expect(addMerchantToMapping).toHaveBeenCalledWith('NEW', 'Expenses:Food');
    });

    it('should delegate without category', () => {
      service.addMerchantToCategory('NEW');
      expect(addMerchantToMapping).toHaveBeenCalledWith('NEW', undefined);
    });

    it('should throw when delegate throws', () => {
      (addMerchantToMapping as jest.Mock).mockImplementationOnce(() => {
        throw new Error('write error');
      });
      expect(() => service.addMerchantToCategory('BAD')).toThrow('write error');
    });
  });

  describe('getAllMerchantCategoryMappings', () => {
    it('should return a copy of mappings', () => {
      const mappings = service.getAllMerchantCategoryMappings();
      expect(mappings).toHaveProperty('GRAB FOOD', 'Expenses:Food:Dining');
    });
  });
});
