import { AccountName } from '../../domain/models/account';

export interface MerchantCategoryMapping {
  merchant: string;
  category: AccountName;
  description?: string;
}

export const merchantCategoryMappings: MerchantCategoryMapping[] = [
  // Education
  { merchant: 'PARIPOSA PRIVATE LIMITED', category: AccountName.ExpensesEducationKindergarten },
  { merchant: 'PAP COMMUNITY FOUNDATION', category: AccountName.ExpensesEducationKindergarten },

  // Shopping
  { merchant: 'TOP-UP TO PAYLAH!', category: AccountName.ExpensesShoppingPayla },
  { merchant: 'NTUC FP-CLEMENTI A', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'NTUC FAIRPRICE ONLINE', category: AccountName.ExpensesShoppingSupermarket },
  { merchant: 'SAFRA-TOA PAYOH', category: AccountName.ExpensesShoppingKids },
  { merchant: 'SAFRA - JURONG CLUB', category: AccountName.ExpensesShoppingKids },
  { merchant: 'SAFRA PUNGGOL CLUB', category: AccountName.ExpensesShoppingKids },
  { merchant: 'OPENAI', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'GIANT-BEAUTY WORLD', category: AccountName.ExpensesShoppingSupermarket },
  { merchant: 'MCDONALD\'S (TPS)', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'BREADTALK-CM', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'DIGINUT PTE LTD', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'FAIRPRICE FINEST-BT', category: AccountName.ExpensesShoppingSupermarket },
  { merchant: 'A-ONE SIGNATURE - WML', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'POLAR PUFFS & CAKES', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'FOUR LEAVES', category: AccountName.ExpensesShoppingOffline },
  { merchant: '7 ELEVEN', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'TIMBRE+', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'U STARS - SUPERMARKET', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'SHENGSIONG', category: AccountName.ExpensesShoppingSupermarket },
  { merchant: 'JAPAN HOME (RETAIL)', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'KOPITIAM', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'KIZTOPIA CCK PTE LTD', category: AccountName.ExpensesShoppingKids },
  { merchant: 'ADAMO ENTERPRISE', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'ACTIONCITY MBS', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'SWEE HENG BAKERY', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'TAKASHIMAYA', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'SBTB STALL', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'BEVERAGES', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'HEAVENLY WANG', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'WWW.OPEN.GOV.SG', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'LAO JIANG SUPERIOR SOU', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'NET*SHEER TECHNOLOGY', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'IPPUDO', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'RASAPURA', category: AccountName.ExpensesShoppingOffline },
  { merchant: 'BBQ BOX', category: AccountName.ExpensesFood },
  { merchant: 'POKKA PTE LTD', category: AccountName.ExpensesShoppingOffline },

  // Food
  { merchant: 'KOUFU PTE LTD', category: AccountName.ExpensesFood },
  { merchant: 'NET*DINGTELE', category: AccountName.ExpensesFood },
  { merchant: 'CAKE AVENUE PTE LTD', category: AccountName.ExpensesFood },

  // Transport
  { merchant: 'EZL.ATU', category: AccountName.ExpensesTransportEzLink },
  { merchant: 'BUS/MRT', category: AccountName.ExpensesTransportBus },
  { merchant: 'COMFORT/CITYCAB TAXI', category: AccountName.ExpensesTransportTaxi },
  { merchant: 'GRAB RIDES-EC', category: AccountName.ExpensesTransportGrab },
  { merchant: 'GRAB*', category: AccountName.ExpensesTransportGrab },

  // Housing
  { merchant: '115-26044-8', category: AccountName.ExpensesHousingRent },

  // Utilities
  { merchant: 'SP DIGITAL', category: AccountName.ExpensesUtilities },

  // Investment
  { merchant: 'DEPNEW3', category: AccountName.AssetsSGDMoomoo },
  { merchant: 'SCL:99190900601:I-BANK', category: AccountName.AssetsSGDBitcoin },

  // Cash
  { merchant: 'ATM Cash Withdrawal', category: AccountName.ExpensesCash },

  // Insurance
  { merchant: 'INCOME INSURANCE LIMITED', category: AccountName.ExpensesInsurance },
  { merchant: 'INTEGRATED HEALTH PLANS PTE LTD', category: AccountName.ExpensesInsurance },

  // Sport
  { merchant: 'ACTIVESG DD', category: AccountName.ExpensesSportActivieSG },

  // Income
  { merchant: 'SHOPEE SINGAPORE PTE', category: AccountName.IncomeSalary },
  { merchant: 'DBS VISA DEBIT CASHBACK', category: AccountName.IncomeBankCashback },

  // Tax
  { merchant: 'IRAS', category: AccountName.ExpensesTaxIncome },

  // Wife's expenses
  { merchant: 'ZOU QIAOLIN', category: AccountName.ExpensesShoppingWife },
  { merchant: '271-384276-4', category: AccountName.ExpensesShoppingWife },
];

/**
 * Helper function to find the category for a merchant
 */
export function findCategoryForMerchant(merchant: string): AccountName | undefined {
  const mapping = merchantCategoryMappings.find(m => 
    merchant.includes(m.merchant) || m.merchant.includes(merchant)
  );
  return mapping?.category;
} 