import { GmailAdapter, Email } from "../../infrastructure/gmail/gmail.adapter";
import { BillParserService } from "../../domain/services/bill-parser.service";
import { AccountingService } from "../../domain/services/accounting.service";
import { ILogger, container, Logger } from "../../infrastructure/utils";
import { ApplicationEventEmitter } from "../../infrastructure/events/event-emitter";
import { TelegramAdapter } from "../../infrastructure/telegram/telegram.adapter";
import { formatTimeToUTC8 } from "../../infrastructure/utils/date.utils";
import { AccountName } from "../../domain/models/account";

// Account to Telegram username mapping (Assets only)
const ACCOUNT_TELEGRAM_MAP: Partial<Record<AccountName, string>> = {
  [AccountName.AssetsDBSSGDWife]: '@LingerZou',
  [AccountName.AssetsDBSSGDSaving]: '@ewardsong',
  [AccountName.AssetsICBCSGDSavings]: '',
  [AccountName.AssetsCMBCRMB]: '',
  [AccountName.AssetsInvestmentSRS]: '',
  [AccountName.AssetsSGDBitcoin]: '',
  [AccountName.AssetsSGDMoomoo]: '',
  [AccountName.AssetsSGDMoomooWife]: '',
};

export class AutomationService {
  private gmailAdapter: GmailAdapter;
  private billParserService: BillParserService;
  private accountingService: AccountingService;
  private logger: ILogger;
  private eventEmitter: ApplicationEventEmitter;
  private telegramAdapter: TelegramAdapter;

  constructor() {
    // 使用提供的依赖，或者从容器通过类名获取
    this.gmailAdapter = container.getByClass(GmailAdapter);
    this.billParserService = container.getByClass(BillParserService);
    this.accountingService = container.getByClass(AccountingService);
    this.logger = container.getByClass(Logger);
    this.eventEmitter = container.getByClass(ApplicationEventEmitter);
    this.telegramAdapter = container.getByClass(TelegramAdapter);
  }

  async scheduledCheck(): Promise<void> {
    try {
      this.logger.info("Starting scheduled bill check...");

      // Fetch unread emails that might contain bills
      this.logger.info("Fetching emails with query: from:(dbs.com)");
      const emails = await this.gmailAdapter.fetchUnreadEmails(
        "from:*@dbs.com"
      );

      this.logger.info(`Found ${emails.length} potential bill emails`);

      if (emails.length === 0) {
        this.logger.info("No bill emails found, finishing check");
        return;
      }

      let processedCount = 0;
      let failedCount = 0;

      for (const email of emails) {
        try {
          this.logger.info(
            `Starting to process email: ${email.subject} (${email.id})`
          );
          this.logger.debug(`Email body: ${email.body}`);
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

      this.logger.info(
        `Bill processing completed. Successfully processed: ${processedCount}, Failed: ${failedCount}`
      );
      this.logger.info("Finished scheduled bill check");
    } catch (error) {
      this.logger.error("Error in scheduled check:", error);
    }
  }

  private async processBillEmail(email: Email): Promise<void> {
    // Extract bill information using the appropriate parser
    const transaction = await this.billParserService.parseBillText(email);

    if (transaction) {
      // Save the transaction
      await this.accountingService.addTransaction(transaction);

      // Mark the email as read
      await this.gmailAdapter.markAsRead(email.id);

      // Send notification to Telegram
      const expenseEntry = transaction.entries[0];

      // Get the account mention based on the account name
      const accountMention = expenseEntry?.account ? ACCOUNT_TELEGRAM_MAP[expenseEntry.account] : '';

      const message = `New transaction:\nTime: <b>${
        formatTimeToUTC8(email.date)
      }</b>\nAmount: <b>${Math.abs(expenseEntry?.amount.value || 0)} ${
        expenseEntry?.amount.currency
      }</b>\nTo: ${transaction.description}\n${
        transaction.entries[1]?.account
      }\n${accountMention}`;
      await this.telegramAdapter.sendNotification(message);

      this.logger.info(
        `Successfully processed bill from email: ${email.subject}`
      );
      this.logger.debug(`Message: ${message}`);
    } else {
      this.logger.warn(
        `Could not extract bill information from email: ${email.subject}`
      );
    }
  }
}
