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
      parseExpenseInput: jest.fn().mockResolvedValue({
        amount: 50,
        currency: 'SGD',
        description: 'lunch',
        category: 'Expenses:Food',
      }),
      addTransaction: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('../../../../domain/models/merchant-category-mapping', () => ({
  get merchantCategoryMappings() { return {}; },
  findCategoryForMerchant: jest.fn(),
  addMerchantToMapping: jest.fn(),
  updateMerchantCategoryMappingsIfNeeded: jest.fn(),
}));

import { ADD_BILL_CONVERSATION_ID, addBillConversation } from '../add-bill';

describe('addBillConversation', () => {
  it('should export conversation function and ID', () => {
    expect(ADD_BILL_CONVERSATION_ID).toBe('addBill');
    expect(typeof addBillConversation).toBe('function');
  });

  it('should have correct function signature (conversation, ctx)', () => {
    expect(addBillConversation.length).toBe(2);
  });

  it('should prompt user for input on entry', async () => {
    const mockReply = jest.fn().mockResolvedValue(undefined);
    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: '/cancel' },
      reply: jest.fn().mockResolvedValue(undefined),
      from: { username: 'ewardsong' },
    });

    const mockConversation = {
      waitFor: mockWaitFor,
      external: jest.fn((fn: () => unknown) => fn()),
      skip: jest.fn(),
      wait: jest.fn(),
    };

    const mockCtx = {
      reply: mockReply,
    };

    await addBillConversation(mockConversation as any, mockCtx as any);

    // Should have sent the initial prompt
    expect(mockReply).toHaveBeenCalledWith(
      expect.stringContaining('Please enter your expense information')
    );
  });

  it('should handle empty text input', async () => {
    const mockReply = jest.fn().mockResolvedValue(undefined);
    const inputReply = jest.fn().mockResolvedValue(undefined);
    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: undefined },
      reply: inputReply,
      from: { username: 'ewardsong' },
    });

    const mockConversation = {
      waitFor: mockWaitFor,
      external: jest.fn((fn: () => unknown) => fn()),
      skip: jest.fn(),
      wait: jest.fn(),
    };

    const mockCtx = {
      reply: mockReply,
    };

    await addBillConversation(mockConversation as any, mockCtx as any);
    expect(inputReply).toHaveBeenCalledWith('Operation cancelled.');
  });

  it('should handle /cancel command', async () => {
    const mockReply = jest.fn().mockResolvedValue(undefined);
    const inputReply = jest.fn().mockResolvedValue(undefined);
    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: '/cancel' },
      reply: inputReply,
      from: { username: 'ewardsong' },
    });

    const mockConversation = {
      waitFor: mockWaitFor,
      external: jest.fn((fn: () => unknown) => fn()),
      skip: jest.fn(),
      wait: jest.fn(),
    };

    const mockCtx = { reply: mockReply };

    await addBillConversation(mockConversation as any, mockCtx as any);
    expect(inputReply).toHaveBeenCalledWith('Operation cancelled.');
  });

  it('should skip other commands', async () => {
    const mockReply = jest.fn().mockResolvedValue(undefined);
    const mockSkip = jest.fn();
    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: '/query' },
      reply: jest.fn().mockResolvedValue(undefined),
      from: { username: 'ewardsong' },
    });

    const mockConversation = {
      waitFor: mockWaitFor,
      external: jest.fn((fn: () => unknown) => fn()),
      skip: mockSkip,
      wait: jest.fn(),
    };

    const mockCtx = { reply: mockReply };

    await addBillConversation(mockConversation as any, mockCtx as any);
    expect(mockSkip).toHaveBeenCalledWith({ next: true });
  });

  it('should handle user without username', async () => {
    const inputReply = jest.fn().mockResolvedValue(undefined);
    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: 'lunch 50' },
      reply: inputReply,
      from: undefined,
    });

    const mockConversation = {
      waitFor: mockWaitFor,
      external: jest.fn((fn: () => unknown) => fn()),
      skip: jest.fn(),
      wait: jest.fn(),
    };

    const mockCtx = { reply: jest.fn().mockResolvedValue(undefined) };

    await addBillConversation(mockConversation as any, mockCtx as any);
    expect(inputReply).toHaveBeenCalledWith(
      expect.stringContaining('Unable to identify user')
    );
  });

  it('should handle unauthorized user', async () => {
    const inputReply = jest.fn().mockResolvedValue(undefined);
    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: 'lunch 50' },
      reply: inputReply,
      from: { username: 'unknown_user' },
    });

    const mockConversation = {
      waitFor: mockWaitFor,
      external: jest.fn((fn: () => unknown) => fn()),
      skip: jest.fn(),
      wait: jest.fn(),
    };

    const mockCtx = { reply: jest.fn().mockResolvedValue(undefined) };

    await addBillConversation(mockConversation as any, mockCtx as any);
    expect(inputReply).toHaveBeenCalledWith(
      expect.stringContaining('do not have permission')
    );
  });

  it('should handle NLP parse error', async () => {
    const inputReply = jest.fn().mockResolvedValue(undefined);
    const mockExternal = jest.fn().mockRejectedValueOnce(new Error('NLP error'));
    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: 'lunch 50' },
      reply: inputReply,
      from: { username: 'ewardsong' },
    });

    const mockConversation = {
      waitFor: mockWaitFor,
      external: mockExternal,
      skip: jest.fn(),
      wait: jest.fn(),
    };

    const mockCtx = { reply: jest.fn().mockResolvedValue(undefined) };

    await addBillConversation(mockConversation as any, mockCtx as any);
    expect(inputReply).toHaveBeenCalledWith(
      expect.stringContaining('cannot process')
    );
  });

  it('should show confirmation after parsing expense', async () => {
    const inputReply = jest.fn().mockResolvedValue(undefined);
    const mockExternal = jest.fn((fn: () => unknown) => fn());
    const mockWait = jest.fn().mockResolvedValue({
      message: { text: '/cancel' },
      reply: jest.fn().mockResolvedValue(undefined),
      callbackQuery: undefined,
    });

    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: 'lunch 50' },
      reply: inputReply,
      from: { username: 'ewardsong' },
    });

    const mockConversation = {
      waitFor: mockWaitFor,
      external: mockExternal,
      skip: jest.fn(),
      wait: mockWait,
    };

    const mockCtx = { reply: jest.fn().mockResolvedValue(undefined) };

    await addBillConversation(mockConversation as any, mockCtx as any);
    // Should have shown transaction details with confirm/cancel keyboard
    expect(inputReply).toHaveBeenCalledWith(
      expect.stringContaining('Transaction Details'),
      expect.objectContaining({ parse_mode: 'HTML' })
    );
  });

  it('should save transaction on confirm', async () => {
    const inputReply = jest.fn().mockResolvedValue(undefined);
    const editMessageText = jest.fn().mockResolvedValue(undefined);
    const answerCallbackQuery = jest.fn().mockResolvedValue(undefined);
    const mockExternal = jest.fn((fn: () => unknown) => fn());

    // After parsing, user clicks confirm
    const mockWait = jest.fn().mockResolvedValue({
      callbackQuery: { data: 'add_confirm' },
      message: undefined,
      editMessageText,
      answerCallbackQuery,
    });

    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: 'lunch 50' },
      reply: inputReply,
      from: { username: 'ewardsong' },
    });

    const mockConversation = {
      waitFor: mockWaitFor,
      external: mockExternal,
      skip: jest.fn(),
      wait: mockWait,
    };

    const mockCtx = { reply: jest.fn().mockResolvedValue(undefined) };

    await addBillConversation(mockConversation as any, mockCtx as any);
    expect(answerCallbackQuery).toHaveBeenCalledWith('Transaction saved!');
  });

  it('should cancel transaction on cancel button', async () => {
    const inputReply = jest.fn().mockResolvedValue(undefined);
    const editMessageText = jest.fn().mockResolvedValue(undefined);
    const answerCallbackQuery = jest.fn().mockResolvedValue(undefined);
    const mockExternal = jest.fn((fn: () => unknown) => fn());

    const mockWait = jest.fn().mockResolvedValue({
      callbackQuery: { data: 'add_cancel' },
      message: undefined,
      editMessageText,
      answerCallbackQuery,
    });

    const mockWaitFor = jest.fn().mockResolvedValue({
      message: { text: 'lunch 50' },
      reply: inputReply,
      from: { username: 'ewardsong' },
    });

    const mockConversation = {
      waitFor: mockWaitFor,
      external: mockExternal,
      skip: jest.fn(),
      wait: mockWait,
    };

    const mockCtx = { reply: jest.fn().mockResolvedValue(undefined) };

    await addBillConversation(mockConversation as any, mockCtx as any);
    expect(answerCallbackQuery).toHaveBeenCalledWith('Transaction cancelled.');
  });
});
