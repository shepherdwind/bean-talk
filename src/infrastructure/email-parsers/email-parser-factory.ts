import { Email } from '../gmail/gmail.adapter';
import { Transaction } from '../../domain/models/transaction';
import { EmailParser } from './email-parser.interface';
import { DBSEmailParser } from './dbs-email-parser';

/**
 * Factory for creating and managing email parsers
 */
export class EmailParserFactory {
  private parsers: EmailParser[] = [];

  constructor() {
    // Register default parsers
    this.registerParser(new DBSEmailParser());
  }

  /**
   * Register a new email parser
   */
  registerParser(parser: EmailParser): void {
    this.parsers.push(parser);
  }

  /**
   * Find a parser that can handle the given email
   */
  findParser(email: Email): EmailParser | null {
    return this.parsers.find(parser => parser.canParse(email)) || null;
  }

  /**
   * Parse an email into a transaction using the appropriate parser
   */
  parseEmail(email: Email): Transaction | null {
    const parser = this.findParser(email);
    if (!parser) {
      console.log(`No parser found for email: ${email.subject} from ${email.from}`);
      return null;
    }

    return parser.parse(email);
  }
} 