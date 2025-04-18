import { GmailAdapter, Email } from '../../infrastructure/gmail/gmail.adapter';
import { BillParserService } from '../../domain/services/bill-parser.service';
import { AccountingService } from '../../domain/services/accounting.service';

export class AutomationService {
  constructor(
    private gmailAdapter: GmailAdapter,
    private billParserService: BillParserService,
    private accountingService: AccountingService
  ) {}

  async scheduledCheck(): Promise<void> {
    try {
      console.log('Starting scheduled bill check...');
      
      // Fetch unread emails that might contain bills
      console.log('Fetching emails with query: subject:(Card Transaction Alert)');
      const emails = await this.gmailAdapter.fetchUnreadEmails(
        'subject:(Card Transaction Alert)'
      );

      console.log(`Found ${emails.length} potential bill emails`);

      if (emails.length === 0) {
        console.log('No bill emails found, finishing check');
        return;
      }

      for (const email of emails) {
        try {
          console.log(`Starting to process email: ${email.subject} (${email.id})`);
          await this.processBillEmail(email);
          console.log(`Finished processing email: ${email.subject}`);
        } catch (error) {
          console.error(`Error processing email ${email.id}:`, error);
          // Continue with next email even if one fails
          continue;
        }
      }

      console.log('Finished scheduled bill check');
    } catch (error) {
      console.error('Error in scheduled check:', error);
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
        emailId: email.id,
        emailSubject: email.subject,
        emailFrom: email.from,
        emailDate: email.date,
      };

      // Save the transaction
      await this.accountingService.addTransaction(transaction);

      // Mark the email as read
      await this.gmailAdapter.markAsRead(email.id);

      console.log(`Successfully processed bill from email: ${email.subject}`);
    } else {
      console.log(`Could not extract bill information from email: ${email.subject}`);
    }
  }
} 