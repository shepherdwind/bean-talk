import { BeancountService } from '../beancount.service';
import { Transaction } from '../../models/transaction';
import { Account } from '../../models/account';
import { Amount, AccountType, Currency } from '../../models/types';
import { promises as fs } from 'fs';
import path from 'path';

describe('BeancountService', () => {
  let service: BeancountService;
  const testFilePath = path.join(__dirname, 'test.beancount');

  beforeEach(() => {
    service = new BeancountService(testFilePath);
  });

  afterEach(async () => {
    try {
      await fs.unlink(testFilePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('transactionToBeancount', () => {
    it('should convert a transaction to beancount format', () => {
      const account: Account = {
        name: 'Assets:Bank:CNY',
        type: AccountType.Asset,
        openDate: '2024-01-01'
      };

      const transaction: Transaction = {
        date: new Date('2024-03-15'),
        description: 'Test transaction',
        entries: [
          {
            account,
            amount: {
              value: 100.50,
              currency: Currency.CNY
            }
          },
          {
            account: {
              ...account,
              name: 'Expenses:Food'
            },
            amount: {
              value: -100.50,
              currency: Currency.CNY
            }
          }
        ],
        metadata: {
          note: 'Test note'
        }
      };

      const expected = `2024-03-15 * "Test transaction"
  Assets:Bank:CNY  100.50 CNY
  Expenses:Food  -100.50 CNY
  ; note: Test note`;

      const result = service.transactionToBeancount(transaction);
      expect(result).toBe(expected);
    });
  });

  describe('appendTransaction', () => {
    it('should append a transaction to the beancount file', async () => {
      const account: Account = {
        name: 'Assets:Bank:CNY',
        type: AccountType.Asset,
        openDate: '2024-01-01'
      };

      const transaction: Transaction = {
        date: new Date('2024-03-15'),
        description: 'Test transaction',
        entries: [
          {
            account,
            amount: {
              value: 100.50,
              currency: Currency.CNY
            }
          },
          {
            account: {
              ...account,
              name: 'Expenses:Food'
            },
            amount: {
              value: -100.50,
              currency: Currency.CNY
            }
          }
        ]
      };

      // First transaction
      await service.appendTransaction(transaction);

      // Second transaction
      const secondTransaction: Transaction = {
        ...transaction,
        description: 'Second transaction',
        date: new Date('2024-03-16')
      };
      await service.appendTransaction(secondTransaction);

      // Read the file and verify content
      const content = await fs.readFile(testFilePath, 'utf-8');
      const expected = `2024-03-15 * "Test transaction"
  Assets:Bank:CNY  100.50 CNY
  Expenses:Food  -100.50 CNY

2024-03-16 * "Second transaction"
  Assets:Bank:CNY  100.50 CNY
  Expenses:Food  -100.50 CNY`;

      expect(content.trim()).toBe(expected);
    });

    it('should create file if it does not exist', async () => {
      const account: Account = {
        name: 'Assets:Bank:CNY',
        type: AccountType.Asset,
        openDate: '2024-01-01'
      };

      const transaction: Transaction = {
        date: new Date('2024-03-15'),
        description: 'Test transaction',
        entries: [
          {
            account,
            amount: {
              value: 100.50,
              currency: Currency.CNY
            }
          }
        ]
      };

      await service.appendTransaction(transaction);

      const content = await fs.readFile(testFilePath, 'utf-8');
      const expected = `2024-03-15 * "Test transaction"
  Assets:Bank:CNY  100.50 CNY`;

      expect(content.trim()).toBe(expected);
    });
  });
}); 