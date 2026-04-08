jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

import { OpenAIAdapter } from '../openai.adapter';

// Helper to create a mock async iterable stream from chunks
function createMockStream(chunks: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const content of chunks) {
        yield { choices: [{ delta: { content } }] };
      }
    },
  };
}

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new OpenAIAdapter({ apiKey: 'test-key' });
  });

  describe('constructor', () => {
    it('should use default model gpt-4o-mini', async () => {
      mockCreate.mockResolvedValue(createMockStream(['response']));

      await adapter.processMessage('system', 'user');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o-mini' })
      );
    });

    it('should use custom model when specified', async () => {
      const customAdapter = new OpenAIAdapter({
        apiKey: 'key',
        model: 'gpt-4',
      });

      mockCreate.mockResolvedValue(createMockStream(['response']));

      await customAdapter.processMessage('system', 'user');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4' })
      );
    });
  });

  describe('processMessage', () => {
    it('should call OpenAI with system and user messages using streaming', async () => {
      mockCreate.mockResolvedValue(createMockStream(['Hello', '!']));

      const result = await adapter.processMessage('Be helpful', 'Hi');
      expect(result).toBe('Hello!');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'Be helpful' },
            { role: 'user', content: 'Hi' },
          ],
          temperature: 0.3,
          max_tokens: 1000,
          stream: true,
        })
      );
    });

    it('should return empty string when no content in chunks', async () => {
      const emptyStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: {} }] };
        },
      };
      mockCreate.mockResolvedValue(emptyStream);

      const result = await adapter.processMessage('system', 'user');
      expect(result).toBe('');
    });

    it('should throw on API error', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit'));
      await expect(adapter.processMessage('s', 'u')).rejects.toThrow('Rate limit');
    });
  });
});
