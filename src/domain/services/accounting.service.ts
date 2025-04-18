import { Transaction } from '../models/transaction';
import { BeancountService } from './beancount.service';

export class AccountingService {
  constructor(private beancountService: BeancountService) {}

  async addTransaction(transaction: Transaction): Promise<void> {
    try {
      await this.beancountService.appendTransaction(transaction);
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  }
} 