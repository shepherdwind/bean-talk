import { Email } from "../gmail/gmail.adapter";
import { Transaction, Entry } from "../../domain/models/transaction";
import { AccountName } from "../../domain/models/account";
import { Amount, Currency } from "../../domain/models/types";
import { EmailParser } from "./email-parser.interface";
import { logger } from "../utils/logger";
import {
  findCategoryForMerchant,
  updateMerchantCategoryMappingsIfNeeded,
  addMerchantToMapping,
} from "../config/merchant-category-mapping";

/**
 * Adapter for parsing DBS transaction alert emails
 */
export class DBSEmailParser implements EmailParser {
  constructor() {}

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
      const amount = this.parseAmount(amountStr, currency);

      // Get merchant category from mapping
      updateMerchantCategoryMappingsIfNeeded();
      const category = findCategoryForMerchant(merchant);

      if (!category) {
        // If merchant not found in mapping, add it to the config file and exit
        addMerchantToMapping(merchant);
        logger.info(
          `Merchant "${merchant}" not found in category mapping. Added to config for manual categorization.`
        );
        return null;
      }

      // Create transaction entries
      const entries: Entry[] = [
        {
          account: AccountName.AssetsDBSSGDSaving,
          amount: amount,
          metadata: {
            merchant,
            cardInfo,
          },
        },
        {
          account: category as AccountName,
          amount: {
            ...amount,
            value: -amount.value, // Negative for expense
          },
        },
      ];

      return {
        date,
        description: `${merchant}`,
        entries,
        metadata: {
          emailId: email.id,
        },
      };
    } catch (error) {
      logger.error("Error parsing DBS email:", error);
      return null;
    }
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
