import { Email } from "../gmail/gmail.adapter";
import { Transaction, Entry } from "../../domain/models/transaction";
import { AccountName } from "../../domain/models/account";
import { Amount, Currency } from "../../domain/models/types";
import { EmailParser } from "./email-parser.interface";
import { logger } from "../utils/logger";
import { ApplicationEventEmitter, MerchantCategorizationEvent } from "../events/event-emitter";
import { container } from "../utils";
import { AccountingService } from "../../domain/services/accounting.service";

/**
 * Interface for transaction data extracted from email
 */
interface TransactionData {
  amount: number;
  date: Date;
  merchant: string;
  cardInfo: string;
  currency: Currency;
}

/**
 * Interface for transaction creation parameters
 */
interface TransactionCreationParams {
  date: Date;
  merchant: string;
  amount: number;
  currency: Currency;
  cardInfo: string;
  category: AccountName;
  emailId: string;
}

/**
 * Adapter for parsing DBS transaction alert emails
 */
export class DBSEmailParser implements EmailParser {
  private eventEmitter: ApplicationEventEmitter;
  private accountingService: AccountingService;

  constructor() {
    this.eventEmitter = container.getByClass(ApplicationEventEmitter);
    this.accountingService = container.getByClass(AccountingService);
  }

  /**
   * Checks if the email is a DBS transaction alert
   */
  canParse(email: Email): boolean {
    return (
      /Transaction Alert/i.test(email.subject) &&
      /@dbs\.com/i.test(email.from)
    );
  }

  /**
   * Parses a DBS transaction alert email into a Transaction
   */
  parse(email: Email): Transaction | null {
    if (!this.canParse(email)) {
      return null;
    }

    try {
      const transactionData = this.extractTransactionData(email);
      if (!transactionData) {
        return null;
      }

      const { amount, date, merchant, cardInfo, currency } = transactionData;

      // Get merchant category from mapping
      const category = this.getMerchantCategory(merchant, email);
      if (!category) {
        return null;
      }

      // Create transaction entries
      return this.createTransaction({ date, merchant, amount, currency, cardInfo, category, emailId: email.id });
    } catch (error) {
      logger.error("Error parsing DBS email:", error);
      return null;
    }
  }

  /**
   * Extracts transaction data from email body
   */
  private extractTransactionData(email: Email): { 
    amount: number; 
    date: Date; 
    merchant: string; 
    cardInfo: string; 
    currency: Currency 
  } | null {
    const amountMatch = email.body.match(/Amount: (SGD|USD)(\d+(\.\d{1,2})?)/i);
    if (!amountMatch) {
      logger.warn("Failed to extract amount from DBS transaction email");
      return null;
    }

    const currency = amountMatch[1].toUpperCase() as Currency;
    const amountStr = amountMatch[2];
    const dateStr = this.extractValue(
      email.body,
      /Date & Time: (\d{2} [A-Za-z]{3} \d{2}:\d{2}) \(SGT\)/i
    );
    const merchant = this.extractValue(email.body, /To: ([^\n]+)/i);
    const cardInfo = this.extractValue(email.body, /From: ([^\n]+)/i);

    if (!dateStr || !merchant) {
      logger.warn("Failed to extract required DBS transaction information");
      return null;
    }

    // Parse date
    const date = this.parseDate(dateStr);

    // Parse amount
    const amount = parseFloat(amountStr);

    return {
      amount,
      date,
      merchant,
      cardInfo: cardInfo || '',
      currency
    };
  }

  /**
   * Gets category for merchant or handles new merchant categorization
   */
  private getMerchantCategory(merchant: string, email: Email): AccountName | null {
    const category = this.accountingService.findCategoryForMerchant(merchant);

    if (!category) {
      // If merchant not found in mapping, add it to the config file and emit event
      this.accountingService.addMerchantToCategory(merchant);
      logger.info(
        `Merchant "${merchant}" not found in category mapping. Added to config for manual categorization.`
      );
      
      this.emitMerchantCategorizationEvent(merchant, email);
      return null;
    }

    return category as AccountName;
  }

  /**
   * Emits an event for merchant categorization
   */
  private emitMerchantCategorizationEvent(merchant: string, email: Email): void {
    const timestamp = new Date().toISOString();
    const merchantId = `${merchant.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    
    const event: MerchantCategorizationEvent = {
      merchant,
      merchantId,
      timestamp,
      email, 
    };

    // Emit an event for the new merchant that needs categorization
    this.eventEmitter.emit('merchantNeedsCategorization', event);
  }

  /**
   * Creates a transaction object from parsed data
   */
  private createTransaction(params: TransactionCreationParams): Transaction {
    const { date, merchant, amount, currency, cardInfo, category, emailId } = params;
    
    const amountObj: Amount = {
      value: amount,
      currency,
    };

    // Create transaction entries
    const entries: Entry[] = [
      {
        account: AccountName.AssetsDBSSGDSaving,
        amount: amountObj,
        metadata: {
          merchant,
          cardInfo,
        },
      },
      {
        account: category,
        amount: {
          ...amountObj,
          value: -amount, // Negative for expense
        },
      },
    ];

    return {
      date,
      description: `${merchant}`,
      entries,
      metadata: {
        emailId,
      },
    };
  }

  private extractValue(text: string, pattern: RegExp): string | null {
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
  }

  private parseDate(dateStr: string): Date {
    // Parse date in format "DD MMM HH:mm" (e.g., "18 Apr 11:26")
    const [day, month, time] = dateStr.split(" ");
    const [hours, minutes] = time.split(":");

    // Map month abbreviation to month number (0-11)
    const monthMap: { [key: string]: number } = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };

    // Create date with current year
    const year = new Date().getFullYear();
    const date = new Date(
      year,
      monthMap[month],
      parseInt(day),
      parseInt(hours),
      parseInt(minutes)
    );

    return date;
  }

  private parseAmount(amountStr: string, currency: Currency): Amount {
    const value = parseFloat(amountStr);
    return {
      value,
      currency,
    };
  }
}
