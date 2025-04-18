import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
import { createServer } from 'http';
import { URL } from 'url';
import { extractEmailHeaders, extractEmailBody } from './email.utils';

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
    console.log('Initializing Gmail adapter...');
    console.log('Setting credentials...');
    this.auth.setCredentials(this.tokens);
    console.log('Credentials set successfully');
    
    // Handle token refresh
    this.auth.on('tokens', async (tokens) => {
      console.log('Token refresh event received');
      if (tokens.refresh_token) {
        console.log('Received new refresh token, saving...');
        this.tokens.refresh_token = tokens.refresh_token;
      }
      if (tokens.access_token) {
        console.log('Received new access token, updating...');
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
          console.log(`Scheduling token refresh in ${refreshTime}ms`);
          setTimeout(() => {
            console.log('Refreshing access token...');
            this.auth.refreshAccessToken();
          }, refreshTime);
        }
      }
    });

    // Verify the auth is working
    try {
      console.log('Verifying Gmail API connection...');
      const response = await this.gmail.users.getProfile({
        auth: this.auth,
        userId: 'me'
      });
      console.log('Gmail API connection verified successfully');
      console.log('Connected as:', response.data.emailAddress);
    } catch (error) {
      console.error('Error verifying Gmail API connection:', error);
      throw error;
    }
  }

  /**
   * Generate OAuth URL for authorization
   */
  generateAuthUrl(): string {
    console.log('Generating OAuth URL for authorization...');
    const url = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ],
      prompt: 'consent'
    });
    console.log('Please visit this URL to authorize the application:');
    console.log(url);
    return url;
  }

  /**
   * Get initial tokens through OAuth flow
   */
  async getInitialTokens(): Promise<GmailTokens> {
    console.log('Starting OAuth flow to get initial tokens...');
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

          console.log('Received authorization code, exchanging for tokens...');
          const { tokens } = await this.auth.getToken(code);
          this.tokens = tokens as GmailTokens;
          await this.saveTokens(this.tokens);
          console.log('Successfully obtained and saved tokens');

          res.writeHead(200);
          res.end('Authorization successful! You can close this window.');
          server.close();
          resolve(this.tokens);
        } catch (error) {
          console.error('Error during authorization:', error);
          res.writeHead(500);
          res.end('Error during authorization');
          server.close();
          reject(error);
        }
      });

      const redirectUri = new URL(this.credentials.redirect_uri);
      server.listen(redirectUri.port || 80, () => {
        console.log(`OAuth server listening on port ${redirectUri.port || 80}`);
      });
    });
  }

  async fetchUnreadEmails(query: string): Promise<Email[]> {
    try {
      // Search for unread emails matching the query
      const response = await this.gmail.users.messages.list({
        auth: this.auth,
        userId: 'me',
        // q: `is:unread ${query}`,
        q: `${query}`,
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
      console.error('Error fetching emails:', error);
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
      console.error('Error marking email as read:', error);
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
      console.error('Error getting email details:', error);
      return null;
    }
  }

  private async saveTokens(tokens: GmailTokens): Promise<void> {
    try {
      console.log('Saving tokens to token.json...');
      await fs.writeFile('token.json', JSON.stringify(tokens, null, 2));
      console.log('Tokens saved successfully');
    } catch (error) {
      console.error('Error saving tokens:', error);
      throw error;
    }
  }
} 