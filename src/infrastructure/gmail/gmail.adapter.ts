import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
import { createServer } from 'http';
import { URL } from 'url';
import { extractEmailHeaders, extractEmailBody } from './email.utils';
import { logger } from '../utils/logger';

export interface GmailCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export interface GmailTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface Email {
  id: string;
  to: string;
  subject: string;
  from: string;
  date?: string;
  body: string;
}

export class GmailAdapter {
  private auth: OAuth2Client;
  private gmail = google.gmail('v1');

  constructor(
    private credentials: GmailCredentials,
    private tokens: GmailTokens
  ) {
    this.auth = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uri
    );
  }

  static async loadCredentials(path: string): Promise<GmailCredentials> {
    const rawCredentials = JSON.parse(await fs.readFile(path, 'utf-8'));
    return {
      client_id: rawCredentials.installed.client_id,
      client_secret: rawCredentials.installed.client_secret,
      redirect_uri: rawCredentials.installed.redirect_uris[0]
    };
  }

  async init(): Promise<void> {
    logger.info('Initializing Gmail adapter...');
    logger.info('Setting credentials...');
    this.auth.setCredentials(this.tokens);
    logger.info('Credentials set successfully');
    
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
      await this.saveTokens(this.tokens);
    });

    // Set up automatic token refresh
    this.auth.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        // Schedule token refresh 5 minutes before expiry
        const expiryDate = tokens.expiry_date || 0;
        const refreshTime = expiryDate - Date.now() - 5 * 60 * 1000;
        if (refreshTime > 0) {
          logger.info(`Scheduling token refresh in ${refreshTime}ms`);
          setTimeout(() => {
            logger.info('Refreshing access token...');
            this.auth.refreshAccessToken();
          }, refreshTime);
        }
      }
    });

    // Verify the auth is working
    try {
      logger.info('Verifying Gmail API connection...');
      const response = await this.gmail.users.getProfile({
        auth: this.auth,
        userId: 'me'
      });
      logger.info('Gmail API connection verified successfully');
      logger.info('Connected as:', response.data.emailAddress);
    } catch (error) {
      logger.error('Error verifying Gmail API connection:', error);
      throw error;
    }
  }

  /**
   * Generate OAuth URL for authorization
   */
  generateAuthUrl(): string {
    logger.info('Generating OAuth URL for authorization...');
    const url = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ],
      prompt: 'consent'
    });
    logger.info('Please visit this URL to authorize the application:');
    logger.debug(url);
    return url;
  }

  /**
   * Get initial tokens through OAuth flow
   */
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
          await this.saveTokens(this.tokens);
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

      const redirectUri = new URL(this.credentials.redirect_uri);
      server.listen(redirectUri.port || 80, () => {
        logger.info(`OAuth server listening on port ${redirectUri.port || 80}`);
      });
    });
  }

  async fetchUnreadEmails(query: string): Promise<Email[]> {
    try {
      // Search for unread emails matching the query
      const response = await this.gmail.users.messages.list({
        auth: this.auth,
        userId: 'me',
        q: `is:unread ${query}`,
        // q: `${query}`,
      });

      const messages = response.data.messages || [];
      const emails: Email[] = [];

      for (const message of messages) {
        const email = await this.getEmailDetails(message.id!);
        if (email) {
          emails.push(email);
        }
      }

      return emails;
    } catch (error) {
      logger.error('Error fetching emails:', error);
      throw error;
    }
  }

  async markAsRead(emailId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        auth: this.auth,
        userId: 'me',
        id: emailId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
    } catch (error) {
      logger.error('Error marking email as read:', error);
      throw error;
    }
  }

  private async getEmailDetails(messageId: string): Promise<Email | null> {
    try {
      const response = await this.gmail.users.messages.get({
        auth: this.auth,
        userId: 'me',
        id: messageId,
      });

      const headers = extractEmailHeaders(response.data.payload?.headers || []);
      const body = extractEmailBody(response.data.payload || {});

      return {
        id: messageId,
        ...headers,
        body,
      };
    } catch (error) {
      logger.error('Error getting email details:', error);
      return null;
    }
  }

  private async saveTokens(tokens: GmailTokens): Promise<void> {
    try {
      logger.info('Saving tokens to token.json...');
      await fs.writeFile('token.json', JSON.stringify(tokens, null, 2));
      logger.info('Tokens saved successfully');
    } catch (error) {
      logger.error('Error saving tokens:', error);
      throw error;
    }
  }
}