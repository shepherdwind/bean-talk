import { Email } from "../gmail/gmail.adapter";
import { Transaction, Entry } from "../../domain/models/transaction";
import { AccountName } from "../../domain/models/account";
import { Amount, Currency } from "../../domain/models/types";
import { EmailParser } from "./email-parser.interface";
import { logger } from "../utils/logger";
import { ApplicationEventEmitter, MerchantCategorizationEvent } from "../events/event-emitter";
import { container } from "../utils";
import { AccountingService } from "../../domain/services/accounting.service";
import { extractTransactionData, TransactionData } from "./dbs-transaction-extractor";
import { EventTypes } from '../events/event-types';
import { formatDateToUTC8 } from "../utils/date.utils";

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
  account: AccountName;
}

/**
 * Adapter for parsing DBS transaction alert emails
 */
export class DBSEmailParser implements EmailParser {
  private get eventEmitter(): ApplicationEventEmitter {
    return container.getByClass(ApplicationEventEmitter);
  }

  private get accountingService(): AccountingService {
    return container.getByClass(AccountingService);
  }

  /**
   * Checks if the email is a DBS transaction alert
   */
  canParse(email: Email): boolean {
    const subject = email.subject;
    const isSubjectMatch = /Transaction Alert/i.test(subject) || /iBanking Alert/i.test(subject);
    const isFromMatch = /@dbs\.com/i.test(email.from);
    return isSubjectMatch && isFromMatch;
  }

  /**
   * Parses a DBS transaction alert email into a Transaction
   */
  parse(email: Email): Transaction | null {
    if (!this.canParse(email)) {
      return null;
    }

    try {
      const transactionData = extractTransactionData(email);
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
      return this.createTransaction({
        date, merchant, amount, currency, cardInfo, category, emailId: email.id,
        account: this.getAccountForMerchant(email.body)
      });
    } catch (error) {
      logger.error("Error parsing DBS email:", error);
      return null;
    }
  }
  
  private getAccountForMerchant(cardInfo: string): AccountName {
    if (cardInfo.includes('ending 4267') || cardInfo.includes('ending 8558')) {
      return AccountName.AssetsDBSSGDSaving;
    }

    return AccountName.AssetsDBSSGDWife;
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
      amount: {
        value: extractTransactionData(email)?.amount || 0,
        currency: extractTransactionData(email)?.currency || 'SGD'
      }
    };

    logger.info("Emitting merchant categorization event:", event.merchant, event.amount);
    // Emit an event for the new merchant that needs categorization
    this.eventEmitter.emit(EventTypes.MERCHANT_NEEDS_CATEGORIZATION, event);
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
        account: params.account,
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
        date,
        cardInfo,
      },
    };
  }
}
