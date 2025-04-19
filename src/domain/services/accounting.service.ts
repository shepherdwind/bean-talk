import { Transaction } from '../models/transaction';
import { BeancountService } from './beancount.service';
import { logger, container } from '../../infrastructure/utils';

export class AccountingService {
  private beancountService: BeancountService;

  constructor(beancountService?: BeancountService) {
    // 如果提供了直接依赖，使用它；否则从容器通过类名获取
    this.beancountService = beancountService || container.getByClass(BeancountService);
  }

  async addTransaction(transaction: Transaction): Promise<void> {
    try {
      await this.beancountService.appendTransaction(transaction);
    } catch (error) {
      logger.error('Error adding transaction:', error);
      throw error;
    }
  }
}