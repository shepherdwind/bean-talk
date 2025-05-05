import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
import { createServer } from 'http';
import { URL } from 'url';
import { logger } from '../utils/logger';
import { GmailCredentials, GmailTokens } from './types';
import { container } from '../utils/container';
import { TelegramAdapter } from '../telegram/telegram.adapter';

export class TokenManager {
  private auth: OAuth2Client;
  private tokens: GmailTokens;
  private static readonly CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH || './credentials.json';
  private static readonly TOKENS_PATH = process.env.GMAIL_TOKENS_PATH || './token.json';

  constructor(
    private credentials: GmailCredentials,
    tokens?: GmailTokens
  ) {
    // Use GMAIL_REDIRECT_URI if provided, otherwise use the one from credentials
    const redirectUri = process.env.GMAIL_REDIRECT_URI || credentials.redirect_uri;
    
    this.auth = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      redirectUri
    );
    this.tokens = tokens || {
      access_token: '',
      refresh_token: '',
      scope: '',
      token_type: '',
      expiry_date: 0
    };
  }

  static async loadCredentials(): Promise<GmailCredentials> {
    const rawCredentials = JSON.parse(await fs.readFile(TokenManager.CREDENTIALS_PATH, 'utf-8'));
    const credentials = rawCredentials.web || rawCredentials.installed;
    if (!credentials) {
      throw new Error('Invalid credentials format: missing both "web" and "installed" configurations');
    }
    
    const defaultRedirectUri = credentials.redirect_uris[0];
    
    // 如果是本地开发环境，确保带上端口
    if (defaultRedirectUri.includes('localhost')) {
      const redirectUri = new URL(defaultRedirectUri);
      redirectUri.port = process.env.PORT || '3000';
      return {
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        redirect_uri: redirectUri.toString()
      };
    }
    
    // 生产环境使用 GMAIL_REDIRECT_URI 或默认的 redirect_uri
    const redirectUri = process.env.GMAIL_REDIRECT_URI || defaultRedirectUri;
    logger.info(`Using redirect URI: ${redirectUri}`);
    return {
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      redirect_uri: redirectUri
    };
  }

  static async loadTokens(): Promise<GmailTokens | null> {
    try {
      const tokens = JSON.parse(await fs.readFile(TokenManager.TOKENS_PATH, 'utf-8'));
      return tokens as GmailTokens;
    } catch (error) {
      logger.warn('No existing tokens found');
      return null;
    }
  }

  private async sendAuthorizationNotification(authUrl: string): Promise<void> {
    // Send auth URL through Telegram bot
    try {
      const telegramAdapter = container.getByClass(TelegramAdapter);
      await telegramAdapter.sendNotification(
        'Please authorize Gmail access:\n\n' +
        '<a href="' + authUrl + '">Click here to authorize</a>'
      );
      logger.info('Authorization URL sent through Telegram');
    } catch (error) {
      logger.error('Failed to send authorization URL through Telegram:', error);
    }
  }

  static async initialize(): Promise<TokenManager> {
    logger.info('Initializing Gmail authentication...');
    
    // Load credentials
    const credentials = await TokenManager.loadCredentials();
    
    // Try to load existing tokens
    let tokens = await TokenManager.loadTokens();
    
    // If no tokens exist or tokens are invalid, start OAuth flow
    if (!tokens || !tokens.refresh_token) {
      logger.info('No valid tokens found. Starting OAuth flow...');
      const tokenManager = new TokenManager(credentials);
      const authUrl = tokenManager.generateAuthUrl();
      logger.info('Please visit this URL to authorize the application:');
      logger.info(authUrl);
      await tokenManager.sendAuthorizationNotification(authUrl);
      
      tokens = await tokenManager.getInitialTokens();
      await tokenManager.saveTokens();
      logger.info('Gmail authentication successful!');
    }
    
    // Create and initialize token manager
    const tokenManager = new TokenManager(credentials, tokens);
    await tokenManager.init();
    
    return tokenManager;
  }

  async init(): Promise<void> {
    logger.info('Initializing token manager...');
    this.auth.setCredentials(this.tokens);
    
    // Handle token refresh
    this.auth.on('tokens', async (tokens) => {
      logger.info('Token refresh event received');
      if (tokens.refresh_token) {
        logger.info('Received new refresh token, saving...');
        this.tokens.refresh_token = tokens.refresh_token;
      }
      if (tokens.access_token) {
        logger.info('Received new access token, updating...');
        this.tokens.access_token = tokens.access_token;
        this.tokens.expiry_date = tokens.expiry_date || 0;
      }
      await this.saveTokens();
      await this.scheduleTokenRefresh(tokens.expiry_date || 0);
    });

    // Check token status on initialization
    await this.checkAndRefreshToken();
  }

  async scheduleTokenRefresh(expiryDate: number): Promise<void> {
    const refreshTime = expiryDate - Date.now() - 5 * 60 * 1000;
    if (refreshTime > 0) {
      logger.info(`Scheduling token refresh in ${refreshTime}ms`);
      setTimeout(() => {
        logger.info('Refreshing access token...');
        this.auth.refreshAccessToken();
      }, refreshTime);
    }
  }

  async checkAndRefreshToken(): Promise<void> {
    const currentTime = Date.now();
    const tokenExpiryTime = this.tokens.expiry_date;
    const timeUntilExpiry = tokenExpiryTime - currentTime;
    
    if (timeUntilExpiry < 10 * 60 * 1000) { // If token expires in less than 10 minutes
      logger.info('Token is about to expire, refreshing...');
      try {
        const { credentials } = await this.auth.refreshAccessToken();
        if (credentials.refresh_token) {
          this.tokens.refresh_token = credentials.refresh_token;
        }
        if (credentials.access_token) {
          this.tokens.access_token = credentials.access_token;
        }
        if (credentials.expiry_date) {
          this.tokens.expiry_date = credentials.expiry_date;
        }
        await this.saveTokens();
        logger.info('Token refreshed successfully');
      } catch (error: any) {
        if (error.response?.data?.error === 'invalid_grant') {
          logger.error('Token is invalid or has been revoked. Please reauthorize.');
          await this.handleTokenInvalidation();
        } else {
          logger.error('Error refreshing token:', error);
          throw error;
        }
      }
    } else {
      logger.info(`Token is valid for ${Math.floor(timeUntilExpiry / 60000)} minutes`);
      await this.scheduleTokenRefresh(tokenExpiryTime);
    }
  }

  private async handleTokenInvalidation(): Promise<void> {
    logger.info('Handling token invalidation...');
    // Clear existing tokens
    this.tokens = {
      access_token: '',
      refresh_token: '',
      scope: '',
      token_type: '',
      expiry_date: 0
    };
    await this.saveTokens();
    
    // Generate new auth URL
    const authUrl = this.generateAuthUrl();
    logger.info('Please reauthorize by visiting this URL:');
    logger.info(authUrl);
    await this.sendAuthorizationNotification(authUrl);
    
    // Get new tokens through OAuth flow
    try {
      await this.getInitialTokens();
      logger.info('Successfully obtained new tokens');
    } catch (error) {
      logger.error('Failed to obtain new tokens:', error);
      throw error;
    }
  }

  generateAuthUrl(): string {
    logger.info('Generating OAuth URL for authorization...');
    const url = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ],
      prompt: 'consent',
      include_granted_scopes: true
    });
    logger.info('Please visit this URL to authorize the application:');
    logger.debug(url);
    return url;
  }

  async getInitialTokens(): Promise<GmailTokens> {
    logger.info('Starting OAuth flow to get initial tokens...');
    return new Promise((resolve, reject) => {
      const server = createServer(async (req, res) => {
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          const code = url.searchParams.get('code');

          if (!code) {
            res.writeHead(400);
            res.end('Authorization code not found');
            server.close();
            reject(new Error('Authorization code not found'));
            return;
          }

          logger.info('Received authorization code, exchanging for tokens...');
          const { tokens } = await this.auth.getToken(code);
          this.tokens = tokens as GmailTokens;
          await this.saveTokens();
          logger.info('Successfully obtained and saved tokens');

          res.writeHead(200);
          res.end('Authorization successful! You can close this window.');
          server.close();
          resolve(this.tokens);
        } catch (error) {
          logger.error('Error during authorization:', error);
          res.writeHead(500);
          res.end('Error during authorization');
          server.close();
          reject(error);
        }
      });

      const port = process.env.PORT || '3000';
      server.listen(parseInt(port), () => {
        logger.info(`OAuth server listening on port ${port}`);
      });
    });
  }

  private async saveTokens(): Promise<void> {
    try {
      logger.info(`Saving tokens to ${TokenManager.TOKENS_PATH}...`);
      await fs.writeFile(TokenManager.TOKENS_PATH, JSON.stringify(this.tokens, null, 2));
      logger.info('Tokens saved successfully');
    } catch (error) {
      logger.error('Error saving tokens:', error);
      throw error;
    }
  }

  getAuth(): OAuth2Client {
    return this.auth;
  }

  getTokens(): GmailTokens {
    return this.tokens;
  }
} 