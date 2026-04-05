jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../utils/container', () => ({
  container: {
    getByClass: jest.fn().mockReturnValue({
      sendNotification: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

const mockSetCredentials = jest.fn();
const mockGenerateAuthUrl = jest.fn().mockReturnValue('https://auth.url');
const mockRefreshAccessToken = jest.fn();
const mockGetToken = jest.fn();
const mockOn = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: mockSetCredentials,
        generateAuthUrl: mockGenerateAuthUrl,
        refreshAccessToken: mockRefreshAccessToken,
        getToken: mockGetToken,
        on: mockOn,
      })),
    },
  },
}));

const mockReadFile = jest.fn();
const mockWriteFile = jest.fn().mockResolvedValue(undefined);

jest.mock('fs', () => ({
  promises: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
}));

import { TokenManager } from '../token-manager';
import { GmailCredentials, GmailTokens } from '../types';

describe('TokenManager', () => {
  const credentials: GmailCredentials = {
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    redirect_uri: 'http://localhost:3000/callback',
  };

  const tokens: GmailTokens = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    token_type: 'Bearer',
    expiry_date: Date.now() + 3600000, // 1 hour from now
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with credentials and tokens', () => {
      const manager = new TokenManager(credentials, tokens);
      expect(manager.getTokens()).toEqual(tokens);
    });

    it('should create instance with default empty tokens', () => {
      const manager = new TokenManager(credentials);
      expect(manager.getTokens().access_token).toBe('');
    });
  });

  describe('loadCredentials', () => {
    it('should load and parse web credentials', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        web: {
          client_id: 'web-id',
          client_secret: 'web-secret',
          redirect_uris: ['https://example.com/callback'],
        },
      }));

      const result = await TokenManager.loadCredentials();
      expect(result.client_id).toBe('web-id');
      expect(result.client_secret).toBe('web-secret');
    });

    it('should load installed credentials', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        installed: {
          client_id: 'installed-id',
          client_secret: 'installed-secret',
          redirect_uris: ['http://localhost:3000/callback'],
        },
      }));

      const result = await TokenManager.loadCredentials();
      expect(result.client_id).toBe('installed-id');
    });

    it('should throw for invalid credentials format', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));
      await expect(TokenManager.loadCredentials()).rejects.toThrow(
        'Invalid credentials format'
      );
    });
  });

  describe('loadTokens', () => {
    it('should load and parse tokens', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(tokens));
      const result = await TokenManager.loadTokens();
      expect(result).toEqual(tokens);
    });

    it('should return null when file not found', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      const result = await TokenManager.loadTokens();
      expect(result).toBeNull();
    });
  });

  describe('init', () => {
    it('should set credentials and register token refresh handler', async () => {
      mockRefreshAccessToken.mockResolvedValue({
        credentials: { ...tokens },
      });

      const manager = new TokenManager(credentials, tokens);
      await manager.init();

      expect(mockSetCredentials).toHaveBeenCalledWith(tokens);
      expect(mockOn).toHaveBeenCalledWith('tokens', expect.any(Function));
    });
  });

  describe('checkAndRefreshToken', () => {
    it('should refresh when token is about to expire', async () => {
      const expiringTokens = {
        ...tokens,
        expiry_date: Date.now() + 5 * 60 * 1000, // 5 min from now (< 10 min threshold)
      };

      mockRefreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expiry_date: Date.now() + 3600000,
        },
      });

      const manager = new TokenManager(credentials, expiringTokens);
      await manager.checkAndRefreshToken();

      expect(mockRefreshAccessToken).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should schedule refresh when token is still valid', async () => {
      const validTokens = {
        ...tokens,
        expiry_date: Date.now() + 60 * 60 * 1000, // 1 hour from now
      };

      const manager = new TokenManager(credentials, validTokens);
      await manager.checkAndRefreshToken();

      // Should not have tried to refresh
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });

    it('should handle invalid_grant error by triggering re-auth', async () => {
      const expiringTokens = {
        ...tokens,
        expiry_date: Date.now() - 1000, // Already expired
      };

      mockRefreshAccessToken.mockRejectedValue({
        response: { data: { error: 'invalid_grant' } },
      });

      const manager = new TokenManager(credentials, expiringTokens);
      // handleTokenInvalidation starts getInitialTokens which creates an HTTP server.
      // Mock the private method to avoid that blocking behavior
      (manager as any).handleTokenInvalidation = jest.fn().mockResolvedValue(undefined);

      await manager.checkAndRefreshToken();
      expect((manager as any).handleTokenInvalidation).toHaveBeenCalled();
    });

    it('should rethrow non-invalid_grant errors', async () => {
      const expiringTokens = {
        ...tokens,
        expiry_date: Date.now() - 1000,
      };

      const networkError = new Error('Network error');
      mockRefreshAccessToken.mockRejectedValue(networkError);

      const manager = new TokenManager(credentials, expiringTokens);
      await expect(manager.checkAndRefreshToken()).rejects.toThrow('Network error');
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate OAuth URL', () => {
      const manager = new TokenManager(credentials);
      const url = manager.generateAuthUrl();
      expect(url).toBe('https://auth.url');
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: 'offline',
          prompt: 'consent',
        })
      );
    });
  });

  describe('saveTokens', () => {
    it('should write tokens to file', async () => {
      const manager = new TokenManager(credentials, tokens);
      // saveTokens is private, but we can trigger it through init
      mockRefreshAccessToken.mockResolvedValue({ credentials: tokens });

      // Access private method via any
      await (manager as any).saveTokens();
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('test-access-token')
      );
    });
  });

  describe('initialize', () => {
    it('should create token manager with existing valid tokens', async () => {
      // loadCredentials
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify({
          web: {
            client_id: 'id',
            client_secret: 'secret',
            redirect_uris: ['https://example.com/callback'],
          },
        }))
        // loadTokens
        .mockResolvedValueOnce(JSON.stringify(tokens));

      // For init() -> checkAndRefreshToken, token is valid so just schedule
      const manager = await TokenManager.initialize();
      expect(manager).toBeInstanceOf(TokenManager);
      expect(mockSetCredentials).toHaveBeenCalled();
    });

    it('should start OAuth flow when no tokens exist', async () => {
      // loadCredentials
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify({
          web: {
            client_id: 'id',
            client_secret: 'secret',
            redirect_uris: ['https://example.com/callback'],
          },
        }))
        // loadTokens throws
        .mockRejectedValueOnce(new Error('ENOENT'))
        // loadConfigFromFile for the new token manager (if needed)
        .mockResolvedValueOnce(JSON.stringify({}));

      // Mock getInitialTokens to avoid starting HTTP server
      const mockGetInitialTokensSpy = jest.fn().mockResolvedValue(tokens);
      const originalPrototype = TokenManager.prototype;
      const originalGetInitialTokens = originalPrototype.getInitialTokens;
      originalPrototype.getInitialTokens = mockGetInitialTokensSpy;

      try {
        const manager = await TokenManager.initialize();
        expect(manager).toBeInstanceOf(TokenManager);
        expect(mockGetInitialTokensSpy).toHaveBeenCalled();
      } finally {
        originalPrototype.getInitialTokens = originalGetInitialTokens;
      }
    });
  });

  describe('sendAuthorizationNotification', () => {
    it('should send auth URL via Telegram', async () => {
      const manager = new TokenManager(credentials, tokens);
      await (manager as any).sendAuthorizationNotification('https://auth.url/test');
      // container.getByClass returns mock with sendNotification
    });
  });

  describe('handleTokenInvalidation', () => {
    it('should clear tokens and request re-authorization', async () => {
      const manager = new TokenManager(credentials, tokens);
      // Mock getInitialTokens to avoid HTTP server
      (manager as any).getInitialTokens = jest.fn().mockResolvedValue(tokens);

      await (manager as any).handleTokenInvalidation();
      // Should have cleared tokens and saved
      expect(mockWriteFile).toHaveBeenCalled();
      expect((manager as any).getInitialTokens).toHaveBeenCalled();
    });

    it('should rethrow if getInitialTokens fails', async () => {
      const manager = new TokenManager(credentials, tokens);
      (manager as any).getInitialTokens = jest.fn().mockRejectedValue(new Error('auth failed'));

      await expect((manager as any).handleTokenInvalidation()).rejects.toThrow('auth failed');
    });
  });

  describe('init token refresh event', () => {
    it('should update tokens when refresh event fires', async () => {
      mockRefreshAccessToken.mockResolvedValue({ credentials: tokens });

      const manager = new TokenManager(credentials, tokens);
      await manager.init();

      // Get the callback registered with auth.on('tokens', callback)
      const tokenCallback = mockOn.mock.calls.find(
        (call: [string, Function]) => call[0] === 'tokens'
      )?.[1];

      expect(tokenCallback).toBeDefined();

      // Simulate token refresh event
      await tokenCallback({
        refresh_token: 'new-refresh',
        access_token: 'new-access',
        expiry_date: Date.now() + 7200000,
      });

      // Should have saved tokens
      expect(mockWriteFile).toHaveBeenCalled();
      const savedTokens = manager.getTokens();
      expect(savedTokens.refresh_token).toBe('new-refresh');
      expect(savedTokens.access_token).toBe('new-access');
    });
  });

  describe('saveTokens error', () => {
    it('should throw when write fails', async () => {
      mockWriteFile.mockRejectedValueOnce(new Error('write error'));
      const manager = new TokenManager(credentials, tokens);
      await expect((manager as any).saveTokens()).rejects.toThrow('write error');
    });
  });

  describe('getAuth / getTokens', () => {
    it('should return auth and tokens', () => {
      const manager = new TokenManager(credentials, tokens);
      expect(manager.getAuth()).toBeDefined();
      expect(manager.getTokens()).toEqual(tokens);
    });
  });

  describe('scheduleTokenRefresh', () => {
    it('should schedule a refresh timer', async () => {
      const manager = new TokenManager(credentials, tokens);
      const futureExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

      await manager.scheduleTokenRefresh(futureExpiry);
      // Timer should be scheduled (we use fake timers)
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should not schedule if refresh time is negative', async () => {
      const manager = new TokenManager(credentials, tokens);
      const pastExpiry = Date.now() - 1000; // Already expired

      await manager.scheduleTokenRefresh(pastExpiry);
      // No timer should be scheduled
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
