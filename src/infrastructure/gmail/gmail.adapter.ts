import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';

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
  date: string;
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

  async init(): Promise<void> {
    this.auth.setCredentials(this.tokens);
    
    // Handle token refresh
    this.auth.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        // Save the new refresh token
        this.tokens.refresh_token = tokens.refresh_token;
        await this.saveTokens(this.tokens);
      }
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

      const headers = response.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      // Get email body
      let body = '';
      if (response.data.payload?.body?.data) {
        body = Buffer.from(response.data.payload.body.data, 'base64').toString();
      } else if (response.data.payload?.parts) {
        for (const part of response.data.payload.parts) {
          if (part.mimeType === 'text/plain') {
            body = Buffer.from(part.body?.data || '', 'base64').toString();
            break;
          }
        }
      }

      return {
        id: messageId,
        subject,
        from,
        date,
        body,
      };
    } catch (error) {
      console.error('Error getting email details:', error);
      return null;
    }
  }

  private async saveTokens(tokens: GmailTokens): Promise<void> {
    try {
      await fs.writeFile('token.json', JSON.stringify(tokens, null, 2));
    } catch (error) {
      console.error('Error saving tokens:', error);
      throw error;
    }
  }
} 