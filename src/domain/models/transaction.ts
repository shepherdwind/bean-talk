import { AccountName } from './account';
import { Account } from '../services/accounting.service';
import { Amount } from './types';

/**
 * Represents a transaction entry (posting) in a transaction
 */
export interface Entry {
  /**
   * The account this entry belongs to
   */
  account: AccountName;

  /**
   * The amount of this entry
   */
  amount: Amount;

  /**
   * Additional metadata for this entry
   */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a financial transaction
 */
export interface Transaction {
  /**
   * The date of the transaction
   */
  date: Date;

  /**
   * A description of the transaction
   */
  description: string;

  /**
   * The entries (postings) that make up this transaction
   */
  entries: Entry[];

  /**
   * Additional metadata for this transaction
   */
  metadata?: Record<string, unknown>;
}