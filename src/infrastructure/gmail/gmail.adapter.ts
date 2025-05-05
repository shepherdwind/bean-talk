import { google } from 'googleapis';
import { logger } from '../utils/logger';
import { GmailTokens, Email } from './types';
import { TokenManager } from './token-manager';
import { EmailProcessor } from './email-processor';

export { Email } from './types';
export class GmailAdapter {
  private tokenManager: TokenManager;
  private emailProcessor: EmailProcessor;

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
    this.emailProcessor = new EmailProcessor(this.tokenManager.getAuth());
  }

  static async initialize(): Promise<GmailAdapter> {
    logger.info('Initializing Gmail adapter...');
    const tokenManager = await TokenManager.initialize();
    
    // Verify the auth is working
    try {
      logger.info('Verifying Gmail API connection...');
      const gmail = google.gmail('v1');
      const response = await gmail.users.getProfile({
        auth: tokenManager.getAuth(),
        userId: 'me'
      });
      logger.info('Gmail API connection verified successfully');
      logger.info('Connected as:', response.data.emailAddress);
    } catch (error) {
      logger.error('Error verifying Gmail API connection:', error);
      throw error;
    }

    return new GmailAdapter(tokenManager);
  }

  generateAuthUrl(): string {
    return this.tokenManager.generateAuthUrl();
  }

  async getInitialTokens(): Promise<GmailTokens> {
    return this.tokenManager.getInitialTokens();
  }

  async fetchUnreadEmails(query: string): Promise<Email[]> {
    return this.emailProcessor.fetchUnreadEmails(query);
  }

  async markAsRead(emailId: string): Promise<void> {
    return this.emailProcessor.markAsRead(emailId);
  }
}