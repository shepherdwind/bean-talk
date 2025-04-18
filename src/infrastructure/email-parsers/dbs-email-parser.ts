import { Email } from '../gmail/gmail.adapter';
import { Transaction, Entry } from '../../domain/models/transaction';
import { Account, AccountName } from '../../domain/models/account';
import { AccountType, Amount, Currency } from '../../domain/models/types';
import { EmailParser } from './email-parser.interface';

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
      /Card Transaction Alert/i.test(email.subject) &&
      email.from === 'ibanking.alert@dbs.com'
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
      const amountStr = this.extractValue(email.body, /Amount: SGD(\d+(\.\d{2})?)/i);
      const dateStr = this.extractValue(email.body, /Date & Time: (\d{2} [A-Za-z]{3} \d{2}:\d{2}) \(SGT\)/i);
      const merchant = this.extractValue(email.body, /To: ([^\n]+)/i);
      const cardInfo = this.extractValue(email.body, /From: ([^\n]+)/i);

      if (!amountStr || !dateStr || !merchant) {
        console.log('Failed to extract required DBS transaction information');
        return null;
      }

      // Parse date
      const date = this.parseDate(dateStr);
      
      // Parse amount
      const amount = this.parseAmount(amountStr);

      // Create transaction entries
      const entries: Entry[] = [
        {
          account: AccountName.AssetsDBSSGDSaving,
          amount: amount,
          metadata: {
            merchant,
            cardInfo
          }
        },
        {
          account: AccountName.ExpensesFood,
          amount: {
            ...amount,
            value: -amount.value // Negative for expense
          }
        }
      ];

      return {
        date,
        description: `${merchant}`,
        entries,
        metadata: {
          source: 'email',
          provider: 'DBS',
          emailId: email.id,
          cardInfo
        }
      };
    } catch (error) {
      console.error('Error parsing DBS email:', error);
      return null;
    }
  }

  private extractValue(text: string, pattern: RegExp): string | null {
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
  }

  private parseDate(dateStr: string): Date {
    // Parse date in format "DD MMM HH:mm" (e.g., "18 Apr 11:26")
    const [day, month, time] = dateStr.split(' ');
    const [hours, minutes] = time.split(':');
    
    // Map month abbreviation to month number (0-11)
    const monthMap: { [key: string]: number } = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    // Create date with current year
    const year = new Date().getFullYear();
    const date = new Date(year, monthMap[month], parseInt(day), parseInt(hours), parseInt(minutes));
    
    return date;
  }

  private parseAmount(amountStr: string): Amount {
    const value = parseFloat(amountStr);
    return {
      value,
      currency: Currency.SGD
    };
  }
} 