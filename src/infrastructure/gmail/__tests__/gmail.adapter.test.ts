jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock TokenManager
const mockTokenManagerInit = jest.fn().mockResolvedValue(undefined);
const mockGetAuth = jest.fn().mockReturnValue({});
const mockGenerateAuthUrl = jest.fn().mockReturnValue('https://auth.url');
const mockGetInitialTokens = jest.fn();

jest.mock('../token-manager', () => ({
  TokenManager: {
    initialize: jest.fn().mockResolvedValue({
      getAuth: mockGetAuth,
      generateAuthUrl: mockGenerateAuthUrl,
      getInitialTokens: mockGetInitialTokens,
    }),
    loadCredentials: jest.fn(),
    loadTokens: jest.fn(),
  },
}));

// Mock EmailProcessor
const mockFetchUnreadEmails = jest.fn().mockResolvedValue([]);
const mockMarkAsRead = jest.fn().mockResolvedValue(undefined);

jest.mock('../email-processor', () => ({
  EmailProcessor: jest.fn().mockImplementation(() => ({
    fetchUnreadEmails: mockFetchUnreadEmails,
    markAsRead: mockMarkAsRead,
  })),
}));

// Mock googleapis for getProfile
const mockGetProfile = jest.fn().mockResolvedValue({
  data: { emailAddress: 'test@gmail.com' },
});

jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn().mockReturnValue({
      users: {
        getProfile: mockGetProfile,
      },
    }),
  },
}));

import { GmailAdapter } from '../gmail.adapter';
import { TokenManager } from '../token-manager';

describe('GmailAdapter', () => {
  describe('initialize', () => {
    it('should initialize token manager and verify connection', async () => {
      const adapter = await GmailAdapter.initialize();
      expect(TokenManager.initialize).toHaveBeenCalled();
      expect(mockGetProfile).toHaveBeenCalled();
      expect(adapter).toBeInstanceOf(GmailAdapter);
    });
  });

  describe('fetchUnreadEmails', () => {
    it('should delegate to email processor', async () => {
      const mockEmails = [{ id: '1', subject: 'Test', from: '', to: '', body: '' }];
      mockFetchUnreadEmails.mockResolvedValue(mockEmails);

      const adapter = await GmailAdapter.initialize();
      const result = await adapter.fetchUnreadEmails('from:test');
      expect(result).toEqual(mockEmails);
    });
  });

  describe('markAsRead', () => {
    it('should delegate to email processor', async () => {
      const adapter = await GmailAdapter.initialize();
      await adapter.markAsRead('msg-1');
      expect(mockMarkAsRead).toHaveBeenCalledWith('msg-1');
    });
  });
});
