import { GmailAdapter, Email } from '../../infrastructure/gmail/gmail.adapter';
import { BillParserService } from '../../domain/services/bill-parser.service';
import { AccountingService } from '../../domain/services/accounting.service';
import { ILogger, container, Logger } from '../../infrastructure/utils';

export class AutomationService {
  private gmailAdapter: GmailAdapter;
  private billParserService: BillParserService;
  private accountingService: AccountingService;
  private logger: ILogger;

  constructor(
    gmailAdapter?: GmailAdapter,
    billParserService?: BillParserService,
    accountingService?: AccountingService,
    logger?: ILogger
  ) {
    // 使用提供的依赖，或者从容器通过类名获取
    this.gmailAdapter = gmailAdapter || container.getByClass(GmailAdapter);
    this.billParserService = billParserService || container.getByClass(BillParserService);
    this.accountingService = accountingService || container.getByClass(AccountingService);
    
    // Use getByClass to get logger from the container for consistency
    this.logger = logger || container.getByClass(Logger);
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

      for (const email of emails) {
        try {
          this.logger.info(`Starting to process email: ${email.subject} (${email.id})`);
          await this.processBillEmail(email);
          this.logger.info(`Finished processing email: ${email.subject}`);
        } catch (error) {
          this.logger.error(`Error processing email ${email.id}:`, error);
          // Continue with next email even if one fails
          continue;
        }
      }

      this.logger.info('Finished scheduled bill check');
    } catch (error) {
      this.logger.error('Error in scheduled check:', error);
      throw error;
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
    } else {
      this.logger.warn(`Could not extract bill information from email: ${email.subject}`);
    }
  }
}