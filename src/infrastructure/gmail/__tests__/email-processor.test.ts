jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock googleapis
const mockMessagesList = jest.fn();
const mockMessagesGet = jest.fn();
const mockMessagesModify = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    gmail: () => ({
      users: {
        messages: {
          list: mockMessagesList,
          get: mockMessagesGet,
          modify: mockMessagesModify,
        },
      },
    }),
  },
}));

import { EmailProcessor } from '../email-processor';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  const mockAuth = {};

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new EmailProcessor(mockAuth);
  });

  describe('fetchUnreadEmails', () => {
    it('should return parsed emails', async () => {
      mockMessagesList.mockResolvedValue({
        data: {
          messages: [{ id: 'msg-1' }],
        },
      });

      mockMessagesGet.mockResolvedValue({
        data: {
          payload: {
            headers: [
              { name: 'Subject', value: 'Test' },
              { name: 'From', value: 'from@test.com' },
              { name: 'To', value: 'to@test.com' },
              { name: 'Date', value: '2024-03-15' },
            ],
            body: {
              data: Buffer.from('Email body').toString('base64'),
            },
          },
        },
      });

      const emails = await processor.fetchUnreadEmails('from:test');
      expect(emails).toHaveLength(1);
      expect(emails[0].id).toBe('msg-1');
      expect(emails[0].subject).toBe('Test');
      expect(emails[0].body).toBe('Email body');
    });

    it('should return empty array when no messages', async () => {
      mockMessagesList.mockResolvedValue({
        data: { messages: undefined },
      });

      const emails = await processor.fetchUnreadEmails('from:test');
      expect(emails).toHaveLength(0);
    });

    it('should throw on API error', async () => {
      mockMessagesList.mockRejectedValue(new Error('API error'));
      await expect(processor.fetchUnreadEmails('from:test')).rejects.toThrow('API error');
    });

    it('should skip emails that fail to fetch details', async () => {
      mockMessagesList.mockResolvedValue({
        data: { messages: [{ id: 'msg-1' }] },
      });

      mockMessagesGet.mockRejectedValue(new Error('Not found'));

      const emails = await processor.fetchUnreadEmails('from:test');
      expect(emails).toHaveLength(0);
    });
  });

  describe('markAsRead', () => {
    it('should call modify API to remove UNREAD label', async () => {
      mockMessagesModify.mockResolvedValue({});

      await processor.markAsRead('msg-1');
      expect(mockMessagesModify).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          userId: 'me',
          requestBody: { removeLabelIds: ['UNREAD'] },
        })
      );
    });

    it('should throw on API error', async () => {
      mockMessagesModify.mockRejectedValue(new Error('API error'));
      await expect(processor.markAsRead('msg-1')).rejects.toThrow('API error');
    });
  });
});
