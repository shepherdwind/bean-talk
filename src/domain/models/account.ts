import { AccountType } from './types';

/**
 * Represents a financial account
 */
export interface Account {
  /**
   * The name of the account
   */
  name: string;

  /**
   * The type of the account
   */
  type: AccountType;

  /**
   * The date when this account was opened
   */
  openDate: string;

  /**
   * Optional description of the account
   */
  description?: string;

  /**
   * Additional metadata for this account
   */
  metadata?: Record<string, unknown>;
}

/**
 * Predefined list of accounts
 */
export const accounts: Account[] = [
  // Assets
  { name: 'Assets:ICBC:SGD:Savings', type: AccountType.Asset, openDate: '2019-12-01' },
  { name: 'Assets:DBS:SGD:Wife', type: AccountType.Asset, openDate: '2019-12-01' },
  { name: 'Assets:CMBC:RMB', type: AccountType.Asset, openDate: '2011-10-10' },
  { name: 'Assets:DBS:SGD:Saving', type: AccountType.Asset, openDate: '2011-10-10' },
  { name: 'Assets:Investment:SRS', type: AccountType.Asset, openDate: '2011-10-10' },
  { name: 'Assets:SGD:Bitcoin', type: AccountType.Asset, openDate: '2011-10-10' },
  { name: 'Assets:SGD:Moomoo', type: AccountType.Asset, openDate: '2011-10-10' },
  { name: 'Assets:SGD:Moomoo:Wife', type: AccountType.Asset, openDate: '2011-10-10' },

  // Expenses
  { name: 'Expenses:Cash', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Education:Kindergarten', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Fees:Wires', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Food', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Food:Dining', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Health:Dental', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Health:Eyes', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Health:Medical', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Housing:Rent', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Insurance', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Shopping:Kids', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Shopping:Misc', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Shopping:Offline', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Shopping:Online', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Shopping:Payla', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Shopping:Supermarket', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Shopping:Wife', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Sport:ActivieSG', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Tax:Income', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Transport:Bus', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Transport:EzLink', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Transport:Grab', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Transport:Taxi', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Travel:Flight', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Travel:Hotels', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Travel:Taxi', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Travel:Train', type: AccountType.Expense, openDate: '2011-10-10' },
  { name: 'Expenses:Utilities', type: AccountType.Expense, openDate: '2011-10-10' },

  // Income
  { name: 'Income:Bank:Cashback', type: AccountType.Income, openDate: '2011-10-10' },
  { name: 'Income:Salary', type: AccountType.Income, openDate: '2011-10-10' },

  // Liabilities
  { name: 'Liabilities:Loan:Jihui', type: AccountType.Liability, openDate: '2011-10-10' },
  { name: 'Liabilities:Loan:Mingjun', type: AccountType.Liability, openDate: '2011-10-10' },
  { name: 'Liabilities:Loan:Unknow', type: AccountType.Liability, openDate: '2011-10-10' },
];

/**
 * Get all accounts of a specific type
 */
export function getAccountsByType(type: AccountType): Account[] {
  return accounts.filter(account => account.type === type);
}

/**
 * Get account by name
 */
export function getAccountByName(name: string): Account | undefined {
  return accounts.find(account => account.name === name);
}

/**
 * Get all account names
 */
export function getAllAccountNames(): string[] {
  return accounts.map(account => account.name);
} 