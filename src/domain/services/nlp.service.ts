import { OpenAIAdapter } from '../../infrastructure/openai/openai.adapter';
import { logger, container } from '../../infrastructure/utils';
import { AccountType } from '../models/types';
import { AccountingService } from './accounting.service';

export interface CategoryOptions {
  primaryCategory: string;
  alternativeCategory: string;
  suggestedNewCategory: string;
}

export class NLPService {
  private openaiAdapter: OpenAIAdapter;
  private accountingService: AccountingService;

  constructor(openaiAdapter?: OpenAIAdapter, accountingService?: AccountingService) {
    // 如果提供了直接依赖，使用它；否则从容器通过类名获取
    this.openaiAdapter = openaiAdapter || container.getByClass(OpenAIAdapter);
    this.accountingService = accountingService || container.getByClass(AccountingService);
  }

  async categorizeMerchant(merchant: string, additionalInfo: string): Promise<CategoryOptions> {
    try {
      // Get all expense accounts using AccountingService
      const expenseAccounts = this.accountingService.getAccountsByType(AccountType.Expense);
      const expenseCategories = expenseAccounts.map(account => account.name);

      const prompt = `Please help categorize this merchant based on the following information:

Merchant Name: ${merchant}
Additional Information: ${additionalInfo}

Available categories are:
${expenseCategories.join('\n')}

Please provide three category options in the following format:
1. Primary Category: (choose the most appropriate category from the list above)
2. Alternative Category: (choose another suitable category from the list above)
3. Suggested New Category: (suggest a new category if none of the existing ones fit well)

Respond in exactly this format, with each option on a new line.`;

      const response = await this.openaiAdapter.processMessage(prompt, '');
      const lines = response.trim().split('\n');
      
      return {
        primaryCategory: lines[0].replace('1. Primary Category:', '').trim(),
        alternativeCategory: lines[1].replace('2. Alternative Category:', '').trim(),
        suggestedNewCategory: lines[2].replace('3. Suggested New Category:', '').trim()
      };
    } catch (error) {
      logger.error('Error categorizing merchant:', error);
      throw error;
    }
  }
}