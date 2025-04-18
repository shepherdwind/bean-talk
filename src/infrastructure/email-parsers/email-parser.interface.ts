import { Email } from '../gmail/gmail.adapter';
import { Transaction } from '../../domain/models/transaction';

/**
 * Interface for email parsers that convert emails into transactions
 */
export interface EmailParser {
  /**
   * Checks if this parser can handle the given email
   */
  canParse(email: Email): boolean;

  /**
   * Parses the email into a transaction
   * Returns null if the email cannot be parsed
   */
  parse(email: Email): Transaction | null;
} 