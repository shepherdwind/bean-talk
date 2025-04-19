import { GmailAdapter, Email } from '../../infrastructure/gmail/gmail.adapter';
import { BillParserService } from '../../domain/services/bill-parser.service';
import { AccountingService } from '../../domain/services/accounting.service';
import { ILogger, container, Logger } from '../../infrastructure/utils';
import { TelegramAdapter } from '../../infrastructure/telegram/telegram.adapter';

export class AutomationService {
  private gmailAdapter: GmailAdapter;
  private billParserService: BillParserService;
  private accountingService: AccountingService;
  private logger: ILogger;
  private telegramAdapter: TelegramAdapter;

  constructor() {
    // 使用提供的依赖，或者从容器通过类名获取
    this.gmailAdapter = container.getByClass(GmailAdapter);
    this.billParserService = container.getByClass(BillParserService);
    this.accountingService = container.getByClass(AccountingService);
    this.logger = container.getByClass(Logger);
    this.telegramAdapter = container.getByClass(TelegramAdapter);
  }

  async scheduledCheck(): Promise<void> {
    try {
      this.logger.info('Starting scheduled bill check...');
      
      // Fetch unread emails that might contain bills
      this.logger.info('Fetching emails with query: subject:(Card Transaction Alert)');
      const emails = await this.gmailAdapter.fetchUnreadEmails(
        'subject:(Card Transaction Alert)'
      );

      this.logger.info(`Found ${emails.length} potential bill emails`);

      if (emails.length === 0) {
        this.logger.info('No bill emails found, finishing check');
        return;
      }

      let processedCount = 0;
      let failedCount = 0;

      for (const email of emails) {
        try {
          this.logger.info(`Starting to process email: ${email.subject} (${email.id})`);
          await this.processBillEmail(email);
          this.logger.info(`Finished processing email: ${email.subject}`);
          processedCount++;
        } catch (error) {
          this.logger.error(`Error processing email ${email.id}:`, error);
          failedCount++;
          // Continue with next email even if one fails
          continue;
        }
      }

      // Send notification about the processing results
      if (processedCount > 0 || failedCount > 0) {
        const message = `📧 Bill Processing Report:\n` +
          `✅ Successfully processed: ${processedCount}\n` +
          `❌ Failed to process: ${failedCount}\n` +
          `📊 Total emails checked: ${emails.length}`;
        
        await this.telegramAdapter.sendNotification(message);
      }

      this.logger.info('Finished scheduled bill check');
    } catch (error) {
      this.logger.error('Error in scheduled check:', error);
      
      // Send error notification
      const errorMessage = `⚠️ Error in scheduled bill check:\n${error instanceof Error ? error.message : String(error)}`;
      await this.telegramAdapter.sendNotification(errorMessage);
    }
  }

  private async processBillEmail(email: Email): Promise<void> {
    // Extract bill information using the appropriate parser
    const transaction = await this.billParserService.parseBillText(email);

    if (transaction) {
      // Add metadata about the source
      transaction.metadata = {
        ...transaction.metadata,
        source: 'gmail',
      };

      // Save the transaction
      await this.accountingService.addTransaction(transaction);

      // Mark the email as read
      await this.gmailAdapter.markAsRead(email.id);

      this.logger.info(`Successfully processed bill from email: ${email.subject}`);

      // Send notification for successful bill processing
      const expenseEntry = transaction.entries.find(entry => entry.amount.value < 0);
      const message = `💰 New Transaction Recorded:\n` +
        `🏷️ Description: ${transaction.description}\n` +
        `💵 Amount: ${expenseEntry ? Math.abs(expenseEntry.amount.value) : 0} ${expenseEntry?.amount.currency || ''}\n` +
        `🏦 Account: ${expenseEntry?.account}`;
      
      await this.telegramAdapter.sendNotification(message);
    } else {
      this.logger.warn(`Could not extract bill information from email: ${email.subject}`);
    }
  }
}