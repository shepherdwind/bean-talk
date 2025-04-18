/**
 * Represents the supported currencies in the system
 */
export enum Currency {
  CNY = 'CNY', // Chinese Yuan
  USD = 'USD', // US Dollar
  EUR = 'EUR', // Euro
  JPY = 'JPY', // Japanese Yen
  GBP = 'GBP', // British Pound
  SGD = 'SGD', // Singapore Dollar
}

/**
 * Represents the type of an account
 */
export enum AccountType {
  Asset = 'Asset',      // Assets like cash, bank accounts, investments
  Liability = 'Liability',  // Liabilities like loans, credit cards
  Equity = 'Equity',     // Equity accounts
  Income = 'Income',     // Income accounts
  Expense = 'Expense',    // Expense accounts
  Revenue = 'Revenue',    // Revenue accounts
  Cost = 'Cost',       // Cost of goods sold
  Other = 'Other'     // Other types of accounts
}

/**
 * Represents a monetary amount with its currency
 */
export interface Amount {
  /**
   * The numeric value of the amount
   */
  value: number;

  /**
   * The currency of the amount
   */
  currency: Currency;
} 