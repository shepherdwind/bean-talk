import { google } from 'googleapis';
import { logger } from '../utils/logger';
import { Email } from './types';
import { extractEmailHeaders, extractEmailBody } from './email.utils';

export class EmailProcessor {
  private gmail = google.gmail('v1');

  constructor(private auth: any) {}

  async fetchUnreadEmails(query: string): Promise<Email[]> {
    try {
      const response = await this.gmail.users.messages.list({
        auth: this.auth,
        userId: 'me',
        q: `is:unread ${query}`,
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
} 