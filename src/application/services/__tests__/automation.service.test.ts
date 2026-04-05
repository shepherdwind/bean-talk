jest.mock('../../../infrastructure/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  Logger: jest.fn(),
}));

// Mock merchant-category-mapping to avoid file I/O
jest.mock('../../../domain/models/merchant-category-mapping', () => ({
  get merchantCategoryMappings() { return {}; },
  findCategoryForMerchant: jest.fn(),
  addMerchantToMapping: jest.fn(),
  updateMerchantCategoryMappingsIfNeeded: jest.fn(),
}));

import { container } from '../../../infrastructure/utils';
import { AutomationService } from '../automation.service';
import { GmailAdapter, Email } from '../../../infrastructure/gmail/gmail.adapter';
import { TelegramAdapter } from '../../../infrastructure/telegram/telegram.adapter';
import { BillParserService } from '../../../domain/services/bill-parser.service';
import { AccountingService } from '../../../domain/services/accounting.service';
import { Logger } from '../../../infrastructure/utils';
import { AccountName } from '../../../domain/models/account';
import { Currency } from '../../../domain/models/types';
import { Transaction } from '../../../domain/models/transaction';

function createTestEmail(overrides: Partial<Email> = {}): Email {
  return {
    id: 'email-1',
    subject: 'Card Transaction Alert',
    from: 'alert@dbs.com',
    to: 'test@iling.fun',
    date: '2024-03-15T10:00:00+08:00',
    body: 'test body',
    ...overrides,
  };
}

function createTestTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    date: new Date('2024-03-15'),
    description: 'GRAB FOOD',
    entries: [
      { account: AccountName.AssetsDBSSGDSaving, amount: { value: -50, currency: Currency.SGD } },
      { account: AccountName.ExpensesFoodDining, amount: { value: 50, currency: Currency.SGD } },
    ],
    ...overrides,
  };
}

describe('AutomationService', () => {
  let service: AutomationService;
  let mockGmail: jest.Mocked<GmailAdapter>;
  let mockTelegram: jest.Mocked<TelegramAdapter>;
  let mockBillParser: jest.Mocked<BillParserService>;
  let mockAccounting: jest.Mocked<AccountingService>;
  let mockLogger: { info: jest.Mock; error: jest.Mock; warn: jest.Mock; debug: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    container.clear();

    mockGmail = {
      fetchUnreadEmails: jest.fn().mockResolvedValue([]),
      markAsRead: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<GmailAdapter>;

    mockTelegram = {
      sendNotification: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TelegramAdapter>;

    mockBillParser = {
      parseBillText: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<BillParserService>;

    mockAccounting = {
      addTransaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AccountingService>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    container.registerClass(GmailAdapter, mockGmail);
    container.registerClass(TelegramAdapter, mockTelegram);
    container.registerClass(BillParserService, mockBillParser);
    container.registerClass(AccountingService, mockAccounting);
    container.registerClass(Logger, mockLogger as unknown as Logger);

    service = new AutomationService();
  });

  afterEach(() => {
    container.clear();
  });

  describe('scheduledCheck', () => {
    it('should return early when no emails found', async () => {
      mockGmail.fetchUnreadEmails.mockResolvedValue([]);
      await service.scheduledCheck();
      expect(mockBillParser.parseBillText).not.toHaveBeenCalled();
    });

    it('should process emails and send notifications', async () => {
      const email = createTestEmail();
      const transaction = createTestTransaction();
      mockGmail.fetchUnreadEmails.mockResolvedValue([email]);
      mockBillParser.parseBillText.mockResolvedValue(transaction);

      await service.scheduledCheck();

      expect(mockBillParser.parseBillText).toHaveBeenCalledWith(email);
      expect(mockAccounting.addTransaction).toHaveBeenCalledWith(transaction);
      expect(mockGmail.markAsRead).toHaveBeenCalledWith('email-1');
      expect(mockTelegram.sendNotification).toHaveBeenCalled();

      // Verify notification contains key info
      const msg = mockTelegram.sendNotification.mock.calls[0][0];
      expect(msg).toContain('50');
      expect(msg).toContain('GRAB FOOD');
    });

    it('should continue processing when one email fails', async () => {
      const email1 = createTestEmail({ id: 'e1' });
      const email2 = createTestEmail({ id: 'e2' });
      const transaction = createTestTransaction();

      mockGmail.fetchUnreadEmails.mockResolvedValue([email1, email2]);
      mockBillParser.parseBillText
        .mockRejectedValueOnce(new Error('parse error'))
        .mockResolvedValueOnce(transaction);

      await service.scheduledCheck();

      // Second email should still be processed
      expect(mockAccounting.addTransaction).toHaveBeenCalledTimes(1);
      expect(mockGmail.markAsRead).toHaveBeenCalledWith('e2');
    });

    it('should warn when bill parser returns null', async () => {
      const email = createTestEmail();
      mockGmail.fetchUnreadEmails.mockResolvedValue([email]);
      mockBillParser.parseBillText.mockResolvedValue(null);

      await service.scheduledCheck();

      expect(mockAccounting.addTransaction).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle Gmail fetch error gracefully', async () => {
      mockGmail.fetchUnreadEmails.mockRejectedValue(new Error('Gmail API error'));

      // Should not throw
      await service.scheduledCheck();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
