jest.mock('../../utils/logger', () => ({
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

const mockSendMessage = jest.fn().mockResolvedValue({});
const mockSetMyCommands = jest.fn().mockResolvedValue(undefined);
const mockUse = jest.fn();
const mockCommand = jest.fn();
const mockCallbackQuery = jest.fn();
const mockOn = jest.fn();
const mockCatch = jest.fn();
const mockStart = jest.fn();
const mockStop = jest.fn();

jest.mock('../bot', () => ({
  createBot: jest.fn().mockReturnValue({
    use: mockUse,
    command: mockCommand,
    callbackQuery: mockCallbackQuery,
    on: mockOn,
    catch: mockCatch,
    start: mockStart,
    stop: mockStop,
    api: {
      sendMessage: mockSendMessage,
      setMyCommands: mockSetMyCommands,
    },
    token: 'test-token',
  }),
}));

jest.mock('@grammyjs/conversations', () => ({
  createConversation: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../conversations/add-bill', () => ({
  addBillConversation: jest.fn(),
  ADD_BILL_CONVERSATION_ID: 'addBill',
}));

jest.mock('../conversations/categorization', () => ({
  categorizationConversation: jest.fn(),
  CATEGORIZATION_CONVERSATION_ID: 'categorization',
}));

const mockGetByClass = jest.fn().mockReturnValue({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

jest.mock('../../utils/container', () => ({
  container: {
    getByClass: (...args: unknown[]) => mockGetByClass(...args),
  },
}));

describe('TelegramAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_CHAT_ID: '12345',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Import after mocks are set up
  function importAdapter() {
    // Reset module to pick up env vars
    jest.resetModules();
    // Re-set mocks after resetModules
    jest.doMock('../../utils/logger', () => ({
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      Logger: jest.fn(),
    }));
    jest.doMock('../../utils/container', () => ({
      container: { getByClass: mockGetByClass },
    }));
    jest.doMock('../bot', () => ({
      createBot: jest.fn().mockReturnValue({
        use: mockUse, command: mockCommand, callbackQuery: mockCallbackQuery,
        on: mockOn, catch: mockCatch, start: mockStart, stop: mockStop,
        api: { sendMessage: mockSendMessage, setMyCommands: mockSetMyCommands },
        token: 'test-token',
      }),
    }));
    jest.doMock('@grammyjs/conversations', () => ({
      createConversation: jest.fn().mockReturnValue(jest.fn()),
    }));
    jest.doMock('../conversations/add-bill', () => ({
      addBillConversation: jest.fn(),
      ADD_BILL_CONVERSATION_ID: 'addBill',
    }));
    jest.doMock('../conversations/categorization', () => ({
      categorizationConversation: jest.fn(),
      CATEGORIZATION_CONVERSATION_ID: 'categorization',
    }));
    jest.doMock('../../../domain/models/merchant-category-mapping', () => ({
      get merchantCategoryMappings() { return {}; },
      findCategoryForMerchant: jest.fn(),
      addMerchantToMapping: jest.fn(),
      updateMerchantCategoryMappingsIfNeeded: jest.fn(),
    }));

    return require('../telegram.adapter');
  }

  describe('constructor', () => {
    it('should create adapter with TELEGRAM_BOT_TOKEN', () => {
      const mod = importAdapter();
      const adapter = new mod.TelegramAdapter();
      expect(adapter).toBeDefined();
    });

    it('should throw when TELEGRAM_BOT_TOKEN is missing', () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      const mod = importAdapter();
      expect(() => new mod.TelegramAdapter()).toThrow('TELEGRAM_BOT_TOKEN is required');
    });

    it('should setup conversations and command handlers', () => {
      const mod = importAdapter();
      new mod.TelegramAdapter();
      // Should have registered conversations with bot.use()
      expect(mockUse).toHaveBeenCalled();
      // Should have registered commands
      expect(mockCommand).toHaveBeenCalled();
    });
  });

  describe('init', () => {
    it('should start bot polling', async () => {
      const mod = importAdapter();
      const adapter = new mod.TelegramAdapter();
      await adapter.init();
      expect(mockStart).toHaveBeenCalled();
      expect(mockSetMyCommands).toHaveBeenCalled();
    });
  });

  describe('sendNotification', () => {
    it('should send plain message without merchantId', async () => {
      const mod = importAdapter();
      const adapter = new mod.TelegramAdapter();
      await adapter.sendNotification('Hello');
      expect(mockSendMessage).toHaveBeenCalledWith('12345', 'Hello', { parse_mode: 'HTML' });
    });

    it('should send message with inline keyboard when merchantId is provided', async () => {
      const mod = importAdapter();
      const adapter = new mod.TelegramAdapter();
      await adapter.sendNotification('Categorize?', 'merchant-1', { merchant: 'GRAB', merchantId: 'merchant-1' });
      expect(mockSendMessage).toHaveBeenCalledWith(
        '12345',
        'Categorize?',
        expect.objectContaining({
          parse_mode: 'HTML',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        })
      );
    });

    it('should skip when no chatId configured', async () => {
      delete process.env.TELEGRAM_CHAT_ID;
      const mod = importAdapter();
      const adapter = new mod.TelegramAdapter();
      await adapter.sendNotification('Hello');
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should retry on send failure', async () => {
      jest.useFakeTimers();
      mockSendMessage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({});

      const mod = importAdapter();
      const adapter = new mod.TelegramAdapter();

      const promise = adapter.sendNotification('Hello');

      // Advance timers for retry delays
      await jest.advanceTimersByTimeAsync(10000);
      await jest.advanceTimersByTimeAsync(10000);

      await promise;
      expect(mockSendMessage).toHaveBeenCalledTimes(3);
      jest.useRealTimers();
    });
  });

  describe('pending merchant helpers', () => {
    it('getPendingMerchant should return undefined for unknown shortId', () => {
      const mod = importAdapter();
      expect(mod.getPendingMerchant('unknown')).toBeUndefined();
    });

    it('removePendingMerchant should not throw for unknown shortId', () => {
      const mod = importAdapter();
      expect(() => mod.removePendingMerchant('unknown')).not.toThrow();
    });

    it('removePendingMerchantByMerchantId should not throw for unknown id', () => {
      const mod = importAdapter();
      expect(() => mod.removePendingMerchantByMerchantId('unknown')).not.toThrow();
    });
  });

  describe('getBotInstance', () => {
    it('should return the bot', () => {
      const mod = importAdapter();
      const adapter = new mod.TelegramAdapter();
      expect(adapter.getBotInstance()).toBeDefined();
    });
  });
});
