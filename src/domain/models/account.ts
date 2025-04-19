import { AccountType } from './types';

/**
 * Enum representing all account names
 */
export enum AccountName {
  // Assets
  AssetsICBCSGDSavings = 'Assets:ICBC:SGD:Savings',
  AssetsDBSSGDWife = 'Assets:DBS:SGD:Wife',
  AssetsCMBCRMB = 'Assets:CMBC:RMB',
  AssetsDBSSGDSaving = 'Assets:DBS:SGD:Saving',
  AssetsInvestmentSRS = 'Assets:Investment:SRS',
  AssetsSGDBitcoin = 'Assets:SGD:Bitcoin',
  AssetsSGDMoomoo = 'Assets:SGD:Moomoo',
  AssetsSGDMoomooWife = 'Assets:SGD:Moomoo:Wife',

  // Expenses
  ExpensesCash = 'Expenses:Cash',
  ExpensesEducationKindergarten = 'Expenses:Education:Kindergarten',
  ExpensesFeesWires = 'Expenses:Fees:Wires',
  ExpensesFood = 'Expenses:Food',
  ExpensesFoodOnline = 'Expenses:Food:Online',
  ExpensesFoodDining = 'Expenses:Food:Dining',
  ExpensesHealthDental = 'Expenses:Health:Dental',
  ExpensesHealthEyes = 'Expenses:Health:Eyes',
  ExpensesHealthMedical = 'Expenses:Health:Medical',
  ExpensesHousingRent = 'Expenses:Housing:Rent',
  ExpensesInsurance = 'Expenses:Insurance',
  ExpensesShoppingKids = 'Expenses:Shopping:Kids',
  ExpensesShoppingMisc = 'Expenses:Shopping:Misc',
  ExpensesShoppingOffline = 'Expenses:Shopping:Offline',
  ExpensesShoppingOnline = 'Expenses:Shopping:Online',
  ExpensesShoppingPayla = 'Expenses:Shopping:Payla',
  ExpensesShoppingSupermarket = 'Expenses:Shopping:Supermarket',
  ExpensesShoppingWife = 'Expenses:Shopping:Wife',
  ExpensesSportActivieSG = 'Expenses:Sport:ActivieSG',
  ExpensesTaxIncome = 'Expenses:Tax:Income',
  ExpensesTransportBus = 'Expenses:Transport:Bus',
  ExpensesTransportEzLink = 'Expenses:Transport:EzLink',
  ExpensesTransportGrab = 'Expenses:Transport:Grab',
  ExpensesTransportTaxi = 'Expenses:Transport:Taxi',
  ExpensesTravelFlight = 'Expenses:Travel:Flight',
  ExpensesTravelHotels = 'Expenses:Travel:Hotels',
  ExpensesTravelTaxi = 'Expenses:Travel:Taxi',
  ExpensesTravelTrain = 'Expenses:Travel:Train',
  ExpensesUtilities = 'Expenses:Utilities',

  // Income
  IncomeBankCashback = 'Income:Bank:Cashback',
  IncomeSalary = 'Income:Salary',

  // Liabilities
  LiabilitiesLoanJihui = 'Liabilities:Loan:Jihui',
  LiabilitiesLoanMingjun = 'Liabilities:Loan:Mingjun',
  LiabilitiesLoanUnknow = 'Liabilities:Loan:Unknow',
}

/**
 * Represents a financial account
 */
export interface Account {
  /**
   * The name of the account
   */
  name: AccountName;

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
 * Get account type from account name
 */
export function getAccountType(name: AccountName): AccountType {
  const prefix = name.split(':')[0];
  switch (prefix) {
    case 'Assets':
      return AccountType.Asset;
    case 'Expenses':
      return AccountType.Expense;
    case 'Income':
      return AccountType.Income;
    case 'Liabilities':
      return AccountType.Liability;
    default:
      throw new Error(`Unknown account type for account: ${name}`);
  }
}

/**
 * Get account by name
 */
export function getAccountByName(name: AccountName): Account {
  return {
    name,
    type: getAccountType(name),
    openDate: '2011-10-10', // Default open date
  };
}

/**
 * Get all accounts of a specific type
 */
export function getAccountsByType(type: AccountType): Account[] {
  return Object.values(AccountName)
    .filter(name => getAccountType(name) === type)
    .map(name => getAccountByName(name));
}

/**
 * Get all account names
 */
export function getAllAccountNames(): AccountName[] {
  return Object.values(AccountName);
} 