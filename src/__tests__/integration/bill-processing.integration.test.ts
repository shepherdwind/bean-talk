import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { container } from '../../infrastructure/utils';
import { Logger } from '../../infrastructure/utils';
import { logger } from '../../infrastructure/utils/logger';
import { ApplicationEventEmitter } from '../../infrastructure/events/event-emitter';
import { EventTypes } from '../../infrastructure/events/event-types';
import { AccountName } from '../../domain/models/account';
import { Email } from '../../infrastructure/gmail/gmail.adapter';

/**
 * Wait for a mock function to be called a specific number of times,
 * with a timeout to avoid hanging tests.
 */
async function waitForMockCalls(
  mockFn: jest.Mock,
  expectedCalls: number,
  timeoutMs = 2000
): Promise<void> {
  const start = Date.now();
  while (mockFn.mock.calls.length < expectedCalls) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timed out waiting for ${expectedCalls} calls, got ${mockFn.mock.calls.length}`
      );
    }
    await new Promise(resolve => setImmediate(resolve));
  }
}

// Mock external adapters
jest.mock('../../infrastructure/gmail/gmail.adapter');
jest.mock('../../infrastructure/telegram/telegram.adapter');
jest.mock('../../infrastructure/openai/openai.adapter');

// Mock merchant-category-mapping to avoid file I/O issues with module-level config path
jest.mock('../../domain/models/merchant-category-mapping', () => {
  let mappings: Record<string, string> = {};
  return {
    get merchantCategoryMappings() { return mappings; },
    set merchantCategoryMappings(v: Record<string, string>) { mappings = v; },
    findCategoryForMerchant: jest.fn((merchant: string) => {
      if (mappings[merchant]) return mappings[merchant];
      for (const [key, value] of Object.entries(mappings)) {
        if (merchant.toLowerCase().includes(key.toLowerCase()) ||
            key.toLowerCase().includes(merchant.toLowerCase())) {
          return value;
        }
      }
      return undefined;
    }),
    addMerchantToMapping: jest.fn((merchant: string, category?: string) => {
      mappings[merchant] = category || '';
    }),
    updateMerchantCategoryMappingsIfNeeded: jest.fn(),
    __setMappings: (m: Record<string, string>) => { mappings = m; },
    __getMappings: () => mappings,
  };
});

import { GmailAdapter } from '../../infrastructure/gmail/gmail.adapter';
import { TelegramAdapter } from '../../infrastructure/telegram/telegram.adapter';
import { OpenAIAdapter } from '../../infrastructure/openai/openai.adapter';
import { AutomationService } from '../../application/services/automation.service';
import { BillParserService } from '../../domain/services/bill-parser.service';
import { AccountingService } from '../../domain/services/accounting.service';
import { BeancountService } from '../../domain/services/beancount.service';
import { EmailParserFactory } from '../../infrastructure/email-parsers';
import { EventListenerService } from '../../infrastructure/events/event-listener.service';
import { NLPService } from '../../domain/services/nlp.service';
import {
  findCategoryForMerchant,
  addMerchantToMapping,
} from '../../domain/models/merchant-category-mapping';

// Access the test helpers from the mock
const merchantMappingMock = jest.requireMock('../../domain/models/merchant-category-mapping') as {
  __setMappings: (m: Record<string, string>) => void;
  __getMappings: () => Record<string, string>;
};

function createTestEmail(overrides: Partial<Email> = {}): Email {
  return {
    id: 'test-email-001',
    subject: 'Card Transaction Alert',
    from: 'ibanking.alert@dbs.com',
    to: 'test@iling.fun',
    date: new Date().toISOString(),
    body: `Card Transaction Alert
Transaction Ref: 510805332088
Dear Sir / Madam,
We refer to your card transaction request dated 18/04/26.
We are pleased to confirm that the transaction was completed.
Date & Time: 18 Apr 13:29 (SGT)
Amount: SGD50.00
From: DBS/POSB card ending 8558
To: GRAB FOOD

Please do not reply to this email as it is auto generated`,
    ...overrides,
  };
}

describe('Bill Processing Integration Tests', () => {
  let tmpDir: string;
  let mockGmailAdapter: jest.Mocked<GmailAdapter>;
  let mockTelegramAdapter: jest.Mocked<TelegramAdapter>;
  let mockOpenAIAdapter: jest.Mocked<OpenAIAdapter>;
  let eventEmitter: ApplicationEventEmitter;

  beforeEach(() => {
    // Create temp directory for beancount files
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bean-talk-test-'));

    // Clear container
    container.clear();

    // Register logger
    container.registerClass(Logger, logger);

    // Set up event emitter
    eventEmitter = new ApplicationEventEmitter();
    container.registerClass(ApplicationEventEmitter, eventEmitter);

    // Set up mock Gmail adapter
    mockGmailAdapter = {
      fetchUnreadEmails: jest.fn().mockResolvedValue([]),
      markAsRead: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<GmailAdapter>;
    container.registerClass(GmailAdapter, mockGmailAdapter);

    // Set up mock Telegram adapter
    mockTelegramAdapter = {
      sendNotification: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TelegramAdapter>;
    container.registerClass(TelegramAdapter, mockTelegramAdapter);

    // Set up mock OpenAI adapter
    mockOpenAIAdapter = {
      processMessage: jest.fn().mockResolvedValue(''),
    } as unknown as jest.Mocked<OpenAIAdapter>;
    container.registerClass(OpenAIAdapter, mockOpenAIAdapter);

    // Register real services
    const emailParserFactory = new EmailParserFactory();
    container.registerClass(EmailParserFactory, emailParserFactory);

    container.registerClassFactory(BeancountService, () => {
      return new BeancountService(tmpDir);
    });

    container.registerClassFactory(AccountingService, () => new AccountingService());
    container.registerClassFactory(BillParserService, () => new BillParserService());
    container.registerClassFactory(NLPService, () => new NLPService());

    // Reset merchant mappings
    merchantMappingMock.__setMappings({});
    (findCategoryForMerchant as jest.Mock).mockClear();
    (addMerchantToMapping as jest.Mock).mockClear();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    container.clear();
    eventEmitter.removeAllListeners();
  });

  describe('Known merchant: email → parse → beancount', () => {
    it('should parse email, write beancount transaction, and mark as read', async () => {
      // Set up known merchant mapping
      merchantMappingMock.__setMappings({
        'GRAB FOOD': AccountName.ExpensesFoodDining,
      });

      const testEmail = createTestEmail();
      mockGmailAdapter.fetchUnreadEmails.mockResolvedValue([testEmail]);

      // Register AutomationService and run
      container.registerClassFactory(AutomationService, () => new AutomationService());
      const automationService = container.getByClass(AutomationService);
      await automationService.scheduledCheck();

      // Verify email was parsed and transaction written
      const year = new Date().getFullYear();
      const beancountDir = path.join(tmpDir, year.toString());
      expect(fs.existsSync(beancountDir)).toBe(true);

      const monthFile = path.join(beancountDir, '04.bean');
      expect(fs.existsSync(monthFile)).toBe(true);

      const content = fs.readFileSync(monthFile, 'utf8');
      expect(content).toContain('GRAB FOOD');
      expect(content).toContain('50.00 SGD');
      expect(content).toContain(AccountName.ExpensesFoodDining);

      // Verify Gmail marked as read
      expect(mockGmailAdapter.markAsRead).toHaveBeenCalledWith('test-email-001');

      // Verify Telegram notification sent
      expect(mockTelegramAdapter.sendNotification).toHaveBeenCalledTimes(1);
      const notifMessage = mockTelegramAdapter.sendNotification.mock.calls[0][0];
      expect(notifMessage).toContain('50');
      expect(notifMessage).toContain('GRAB FOOD');
    });

    it('should handle multiple emails in sequence', async () => {
      merchantMappingMock.__setMappings({
        'GRAB FOOD': AccountName.ExpensesFoodDining,
        'AMAZON': AccountName.ExpensesShoppingOnline,
      });

      const email1 = createTestEmail({ id: 'email-1' });
      const email2 = createTestEmail({
        id: 'email-2',
        body: `Card Transaction Alert
Transaction Ref: 510805332099
Dear Sir / Madam,
Date & Time: 18 Apr 15:00 (SGT)
Amount: USD29.99
From: DBS/POSB card ending 8558
To: AMAZON

Please do not reply to this email as it is auto generated`,
      });

      mockGmailAdapter.fetchUnreadEmails.mockResolvedValue([email1, email2]);

      container.registerClassFactory(AutomationService, () => new AutomationService());
      const automationService = container.getByClass(AutomationService);
      await automationService.scheduledCheck();

      // Both emails should be marked as read
      expect(mockGmailAdapter.markAsRead).toHaveBeenCalledWith('email-1');
      expect(mockGmailAdapter.markAsRead).toHaveBeenCalledWith('email-2');

      // Two notifications should be sent
      expect(mockTelegramAdapter.sendNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('Unknown merchant: email → event → queue → notification', () => {
    it('should emit categorization event when AI confidence is low', async () => {
      merchantMappingMock.__setMappings({});

      // AI returns low confidence — should trigger manual flow
      mockOpenAIAdapter.processMessage.mockResolvedValue(
        '{"primary": "Expenses:Food:Dining", "alternative": "Expenses:Food", "confidence": 0.5}'
      );

      const testEmail = createTestEmail();
      mockGmailAdapter.fetchUnreadEmails.mockResolvedValue([testEmail]);

      const categorizationEvents: unknown[] = [];
      eventEmitter.on(EventTypes.MERCHANT_NEEDS_CATEGORIZATION, (data) => {
        categorizationEvents.push(data);
      });

      container.registerClassFactory(AutomationService, () => new AutomationService());
      const automationService = container.getByClass(AutomationService);
      await automationService.scheduledCheck();

      // No mapping written (removed auto-add with empty category)
      expect(addMerchantToMapping).not.toHaveBeenCalled();

      // Event should have been emitted for manual categorization
      expect(categorizationEvents).toHaveLength(1);
      const event = categorizationEvents[0] as Record<string, unknown>;
      expect(event).toMatchObject({
        merchant: 'GRAB FOOD',
        merchantId: 'grab_food',
      });

      // Email should NOT be marked as read (needs manual categorization)
      expect(mockGmailAdapter.markAsRead).not.toHaveBeenCalled();
    });

    it('should auto-categorize when AI confidence is high', async () => {
      merchantMappingMock.__setMappings({});

      // AI returns high confidence — should auto-categorize
      mockOpenAIAdapter.processMessage.mockResolvedValue(
        '{"primary": "Expenses:Food:Dining", "alternative": "Expenses:Food", "confidence": 0.95}'
      );

      const testEmail = createTestEmail();
      mockGmailAdapter.fetchUnreadEmails.mockResolvedValue([testEmail]);

      // Register listener BEFORE running scheduledCheck
      const categorizationEvents: unknown[] = [];
      eventEmitter.on(EventTypes.MERCHANT_NEEDS_CATEGORIZATION, (data) => {
        categorizationEvents.push(data);
      });

      container.registerClassFactory(AutomationService, () => new AutomationService());
      const automationService = container.getByClass(AutomationService);
      await automationService.scheduledCheck();

      // No manual categorization event (AI handled it)
      expect(categorizationEvents).toHaveLength(0);

      // Transaction should be written (auto-categorized)
      expect(mockGmailAdapter.markAsRead).toHaveBeenCalledWith('test-email-001');

      // No mapping written (AI handles it each time)
      expect(addMerchantToMapping).not.toHaveBeenCalled();
    });

    it('should send Telegram notification through event listener and queue', async () => {
      merchantMappingMock.__setMappings({});

      // AI returns low confidence to trigger manual flow
      mockOpenAIAdapter.processMessage.mockResolvedValue(
        '{"primary": "Expenses:Food:Dining", "alternative": "Expenses:Food", "confidence": 0.3}'
      );

      const testEmail = createTestEmail();
      mockGmailAdapter.fetchUnreadEmails.mockResolvedValue([testEmail]);

      // Set up EventListenerService which wires up the queue
      const eventListenerService = new EventListenerService();
      container.registerClass(EventListenerService, eventListenerService);

      container.registerClassFactory(AutomationService, () => new AutomationService());
      const automationService = container.getByClass(AutomationService);
      container.registerClass(AutomationService, automationService);

      await automationService.scheduledCheck();

      // Wait for async event processing
      await waitForMockCalls(mockTelegramAdapter.sendNotification as jest.Mock, 1);

      // Telegram notification should be sent with merchant info
      expect(mockTelegramAdapter.sendNotification).toHaveBeenCalled();
      const callArgs = mockTelegramAdapter.sendNotification.mock.calls;
      // Find the categorization notification (has merchantId as second arg)
      const categorizationCall = callArgs.find(args => args[1] !== undefined);
      expect(categorizationCall).toBeDefined();
      expect(categorizationCall![0]).toContain('GRAB FOOD');
      expect(categorizationCall![1]).toBe('grab_food');
    });
  });

  describe('Categorization: AI classify → save mapping', () => {
    it('should parse NLP response into two category suggestions with context', async () => {
      mockOpenAIAdapter.processMessage.mockResolvedValue(
        '{"primary": "Expenses:Food:Dining", "alternative": "Expenses:Food"}'
      );

      const nlpService = container.getByClass(NLPService);
      const result = await nlpService.categorizeMerchantWithContext('GRAB FOOD', 'food delivery app');

      expect(result).toEqual({
        primary: 'Expenses:Food:Dining',
        alternative: 'Expenses:Food',
      });

      // Verify user message contains merchant name and additional info
      const userMessage = mockOpenAIAdapter.processMessage.mock.calls[0][1];
      expect(userMessage).toContain('GRAB FOOD');
      expect(userMessage).toContain('food delivery app');
    });

    it('should save category to mapping when MERCHANT_CATEGORY_SELECTED event is emitted', async () => {
      merchantMappingMock.__setMappings({});

      // Set up EventListenerService
      const eventListenerService = new EventListenerService();
      container.registerClass(EventListenerService, eventListenerService);

      // First enqueue a task so completeTask can find it
      // Simulate the categorization flow by emitting events
      eventEmitter.emit(EventTypes.MERCHANT_CATEGORY_SELECTED, {
        merchantId: 'grab_food',
        merchant: 'GRAB FOOD',
        selectedCategory: AccountName.ExpensesFoodDining,
        timestamp: new Date().toISOString(),
      });

      // Wait for async event processing
      await waitForMockCalls(addMerchantToMapping as jest.Mock, 1);

      // Verify merchant mapping was updated
      expect(addMerchantToMapping).toHaveBeenCalledWith(
        'GRAB FOOD',
        AccountName.ExpensesFoodDining
      );
    });

    it('should skip saving when no category is selected (cancel)', async () => {
      const eventListenerService = new EventListenerService();
      container.registerClass(EventListenerService, eventListenerService);

      eventEmitter.emit(EventTypes.MERCHANT_CATEGORY_SELECTED, {
        merchantId: 'grab_food',
        merchant: 'GRAB FOOD',
        selectedCategory: '',
        timestamp: new Date().toISOString(),
      });

      // Give event loop a tick for the sync event handler to fire
      await new Promise(resolve => setImmediate(resolve));

      // Should NOT call addMerchantToMapping
      expect(addMerchantToMapping).not.toHaveBeenCalled();
    });
  });

  describe('Queue behavior', () => {
    it('should process notifications sequentially', async () => {
      merchantMappingMock.__setMappings({});

      const eventListenerService = new EventListenerService();
      container.registerClass(EventListenerService, eventListenerService);

      // Emit two categorization events
      eventEmitter.emit(EventTypes.MERCHANT_NEEDS_CATEGORIZATION, {
        merchant: 'MERCHANT_A',
        merchantId: 'merchant_a',
        timestamp: new Date().toISOString(),
        amount: { value: 10, currency: 'SGD' },
      });

      eventEmitter.emit(EventTypes.MERCHANT_NEEDS_CATEGORIZATION, {
        merchant: 'MERCHANT_B',
        merchantId: 'merchant_b',
        timestamp: new Date().toISOString(),
        amount: { value: 20, currency: 'SGD' },
      });

      await waitForMockCalls(mockTelegramAdapter.sendNotification as jest.Mock, 1);

      // Only first notification should be sent (queue is serial)
      expect(mockTelegramAdapter.sendNotification).toHaveBeenCalledTimes(1);
      expect(mockTelegramAdapter.sendNotification.mock.calls[0][0]).toContain('MERCHANT_A');
    });

    it('should deduplicate tasks for the same merchant', async () => {
      merchantMappingMock.__setMappings({});

      const eventListenerService = new EventListenerService();
      container.registerClass(EventListenerService, eventListenerService);

      // Emit same merchant twice
      eventEmitter.emit(EventTypes.MERCHANT_NEEDS_CATEGORIZATION, {
        merchant: 'MERCHANT_A',
        merchantId: 'merchant_a',
        timestamp: new Date().toISOString(),
        amount: { value: 10, currency: 'SGD' },
      });

      eventEmitter.emit(EventTypes.MERCHANT_NEEDS_CATEGORIZATION, {
        merchant: 'MERCHANT_A',
        merchantId: 'merchant_a',
        timestamp: new Date().toISOString(),
        amount: { value: 20, currency: 'SGD' },
      });

      await waitForMockCalls(mockTelegramAdapter.sendNotification as jest.Mock, 1);

      // Should only process once (dedup by taskId)
      expect(mockTelegramAdapter.sendNotification).toHaveBeenCalledTimes(1);
    });

    it('should advance queue after task completion', async () => {
      merchantMappingMock.__setMappings({});

      const eventListenerService = new EventListenerService();
      container.registerClass(EventListenerService, eventListenerService);

      // Need AutomationService registered for completeTask's scheduledCheck callback
      container.registerClassFactory(AutomationService, () => new AutomationService());
      const automationService = container.getByClass(AutomationService);
      container.registerClass(AutomationService, automationService);
      // Mock scheduledCheck to avoid re-running the full flow
      jest.spyOn(automationService, 'scheduledCheck').mockResolvedValue();

      // Emit two different merchants
      eventEmitter.emit(EventTypes.MERCHANT_NEEDS_CATEGORIZATION, {
        merchant: 'MERCHANT_A',
        merchantId: 'merchant_a',
        timestamp: new Date().toISOString(),
        amount: { value: 10, currency: 'SGD' },
      });

      eventEmitter.emit(EventTypes.MERCHANT_NEEDS_CATEGORIZATION, {
        merchant: 'MERCHANT_B',
        merchantId: 'merchant_b',
        timestamp: new Date().toISOString(),
        amount: { value: 20, currency: 'SGD' },
      });

      await waitForMockCalls(mockTelegramAdapter.sendNotification as jest.Mock, 1);

      // First merchant processed
      expect(mockTelegramAdapter.sendNotification).toHaveBeenCalledTimes(1);

      // Complete first task
      eventEmitter.emit(EventTypes.MERCHANT_CATEGORY_SELECTED, {
        merchantId: 'merchant_a',
        merchant: 'MERCHANT_A',
        selectedCategory: AccountName.ExpensesFoodDining,
        timestamp: new Date().toISOString(),
      });

      await waitForMockCalls(mockTelegramAdapter.sendNotification as jest.Mock, 2);

      // Second merchant should now be processed
      expect(mockTelegramAdapter.sendNotification).toHaveBeenCalledTimes(2);
      expect(mockTelegramAdapter.sendNotification.mock.calls[1][0]).toContain('MERCHANT_B');
    });
  });
});
