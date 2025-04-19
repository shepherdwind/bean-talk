import { Transaction } from '../models/transaction';
import { BeancountService } from './beancount.service';
import { logger } from '../../infrastructure/utils/logger';

export class AccountingService {
  constructor(private beancountService: BeancountService) {}

  async addTransaction(transaction: Transaction): Promise<void> {
    try {
      await this.beancountService.appendTransaction(transaction);
    } catch (error) {
      logger.error('Error adding transaction:', error);
      throw error;
    }
  }
}