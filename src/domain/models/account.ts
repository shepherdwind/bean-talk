import { AccountType } from './types';

/**
 * Enum representing all account names
 */
export enum AccountName {
  // Assets
  AssetsICBCSGDSavings = 'Assets:ICBC:SGD:Savings',
  AssetsDBSSGDWife = 'Assets:DBS:SGD:Wife',
  AssetsCMBCRMB = 'Assets:CMBC:RMB',
  AssetsCash = 'Assets:Cash',
  AssetsCashWife = 'Assets:Cash:Wife',
  AssetsDBSSGDSaving = 'Assets:DBS:SGD:Saving',
  AssetsInvestmentSRS = 'Assets:Investment:SRS',
  AssetsSGDBitcoin = 'Assets:SGD:Bitcoin',
  AssetsSGDMoomoo = 'Assets:SGD:Moomoo',
  AssetsSGDMoomooWife = 'Assets:SGD:Moomoo:Wife',

  // Expenses
  ExpensesEducationKindergarten = 'Expenses:Education:Kindergarten',
  ExpensesEducationKids = 'Expenses:Education:Kids',
  ExpensesEducation = 'Expenses:Education',
  // ExpensesFeesWires = 'Expenses:Fees:Wires',
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

// 账户接口已移动到 AccountService
// 账户相关功能函数已移动到 AccountService