import { Email } from "../gmail/gmail.adapter";
import { Transaction, Entry } from "../../domain/models/transaction";
import { AccountName } from "../../domain/models/account";
import { Amount, Currency } from "../../domain/models/types";
import { EmailParser } from "./email-parser.interface";
import { logger } from "../utils/logger";
import {
  ApplicationEventEmitter,
  MerchantCategorizationEvent,
} from "../events/event-emitter";
import { container } from "../utils";
import { AccountingService } from "../../domain/services/accounting.service";
import {
  extractTransactionData,
  TransactionData,
} from "./dbs-transaction-extractor";
import { EventTypes } from "../events/event-types";
import { getCardAccount } from "../utils/telegram";
import { NLPService } from "../../domain/services/nlp.service";
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
    const isSubjectMatch =
      /Transaction Alert/i.test(subject) ||
      /iBanking Alert/i.test(subject) ||
      /digibank Alert/i.test(subject);
    const isFromMatch = /@dbs\.com/i.test(email.from);
    return isSubjectMatch && isFromMatch;
  }

  /**
   * Parses a DBS transaction alert email into a Transaction
   */
  async parse(email: Email): Promise<Transaction | null> {
    if (!this.canParse(email)) {
      return null;
    }

    try {
      const transactionData = extractTransactionData(email);
      if (!transactionData) {
        return null;
      }

      const { amount, date, merchant, cardInfo, currency } = transactionData;

      // Get merchant category from mapping or AI
      const category = await this.getMerchantCategory(merchant, email);
      if (!category) {
        return null;
      }

      return this.createTransaction({
        date,
        merchant,
        amount,
        currency,
        cardInfo,
        category,
        emailId: email.id,
        account: getCardAccount(email.to),
      });
    } catch (error) {
      logger.error("Error parsing DBS email:", error);
      return null;
    }
  }

  private get nlpService(): NLPService {
    return container.getByClass(NLPService);
  }

  private static readonly AUTO_CATEGORIZE_CONFIDENCE_THRESHOLD = 0.8;

  /**
   * Gets category for merchant: mapping → AI auto → manual flow
   */
  private async getMerchantCategory(
    merchant: string,
    email: Email
  ): Promise<AccountName | null> {
    // 1. Check mapping file (human-confirmed categories)
    const mappedCategory = this.accountingService.findCategoryForMerchant(merchant);
    if (mappedCategory) {
      return mappedCategory as AccountName;
    }

    // 2. Try AI auto-categorization
    const aiResult = await this.nlpService.autoCategorizeMerchant(merchant);
    const validAccountNames = (Object.values(AccountName) as string[])
      .filter(name => name.startsWith('Expenses:'));
    if (
      aiResult.confidence >= DBSEmailParser.AUTO_CATEGORIZE_CONFIDENCE_THRESHOLD &&
      aiResult.category &&
      validAccountNames.includes(aiResult.category)
    ) {
      logger.info(
        `AI auto-categorized "${merchant}" → ${aiResult.category} (confidence: ${aiResult.confidence})`
      );
      return aiResult.category as AccountName;
    }

    if (aiResult.category && !validAccountNames.includes(aiResult.category)) {
      logger.warn(
        `AI returned invalid category "${aiResult.category}" for "${merchant}", falling back to manual`
      );
    }

    // 3. Low confidence — notify for manual categorization with AI suggestions
    logger.info(
      `AI uncertain for "${merchant}" (confidence: ${aiResult.confidence}), requesting manual categorization`
    );
    this.emitMerchantCategorizationEvent(merchant, email, aiResult.suggestions);
    return null;
  }

  /**
   * Emits an event for merchant categorization
   */
  private emitMerchantCategorizationEvent(
    merchant: string,
    email: Email,
    suggestions?: { primary: string; alternative: string }
  ): void {
    const timestamp = new Date().toISOString();
    // Use only merchant name as ID since we only need to categorize each merchant once
    const merchantId = merchant.toLowerCase().replace(/[^a-z0-9]/g, "_");

    const event: MerchantCategorizationEvent = {
      merchant,
      merchantId,
      timestamp,
      email,
      amount: {
        value: extractTransactionData(email)?.amount || 0,
        currency: extractTransactionData(email)?.currency || "SGD",
      },
      suggestions,
    };

    logger.info(
      "Emitting merchant categorization event:",
      event.merchant,
      event.amount
    );
    // Emit an event for the new merchant that needs categorization
    this.eventEmitter.emit(EventTypes.MERCHANT_NEEDS_CATEGORIZATION, event);
  }

  /**
   * Creates a transaction object from parsed data
   */
  private createTransaction(params: TransactionCreationParams): Transaction {
    const { date, merchant, amount, currency, cardInfo, category, emailId } =
      params;

    const amountObj: Amount = {
      value: amount,
      currency,
    };

    // Create transaction entries
    const entries: Entry[] = [
      {
        account: params.account,
        // Negative for Assets account
        amount: {
          ...amountObj,
          value: -amountObj.value,
        },
        metadata: {
          merchant,
          cardInfo,
        },
      },
      {
        account: category,
        amount: amountObj,
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
