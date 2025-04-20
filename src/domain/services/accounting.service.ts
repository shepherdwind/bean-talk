import { Transaction } from '../models/transaction';
import { AccountName } from '../models/account';
import { AccountType } from '../models/types';
import { BeancountService } from './beancount.service';
import { 
  findCategoryForMerchant, 
  addMerchantToMapping, 
  merchantCategoryMappings,
  MerchantCategoryMap 
} from '../models/merchant-category-mapping';
import { logger, container } from '../../infrastructure/utils';

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

export class AccountingService {
  private beancountService: BeancountService;

  constructor(beancountService?: BeancountService) {
    // 如果提供了直接依赖，使用它；否则从容器通过类名获取
    this.beancountService = beancountService || container.getByClass(BeancountService);
  }

  /**
   * 添加交易记录
   */
  async addTransaction(transaction: Transaction): Promise<void> {
    try {
      await this.beancountService.appendTransaction(transaction);
    } catch (error) {
      logger.error('Error adding transaction:', error);
      throw error;
    }
  }

  /**
   * 获取账户类型
   */
  getAccountType(name: AccountName): AccountType {
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
   * 根据名称获取账户
   */
  getAccountByName(name: AccountName): Account {
    return {
      name,
      type: this.getAccountType(name),
      openDate: '2011-10-10', // Default open date
    };
  }

  /**
   * 获取特定类型的所有账户
   */
  getAccountsByType(type: AccountType): Account[] {
    return Object.values(AccountName)
      .filter(name => this.getAccountType(name) === type)
      .map(name => this.getAccountByName(name));
  }

  /**
   * 获取所有账户名称
   */
  getAllAccountNames(): AccountName[] {
    return Object.values(AccountName);
  }

  /**
   * 通过商家名称查找对应的账户分类
   * @param merchant 商家名称
   * @returns 找到的账户分类或undefined
   */
  findCategoryForMerchant(merchant: string): string | undefined {
    try {
      return findCategoryForMerchant(merchant);
    } catch (error) {
      logger.error('Error finding category for merchant:', error);
      return undefined;
    }
  }

  /**
   * 添加商家到分类映射
   * @param merchant 商家名称
   * @param category 可选的分类名称
   */
  addMerchantToCategory(merchant: string, category?: string): void {
    try {
      addMerchantToMapping(merchant, category);
    } catch (error) {
      logger.error('Error adding merchant to category:', error);
      throw error;
    }
  }

  /**
   * 获取所有商家分类映射
   */
  getAllMerchantCategoryMappings(): MerchantCategoryMap {
    return { ...merchantCategoryMappings };
  }
}