import { OpenAIAdapter } from '../../infrastructure/openai/openai.adapter';
import { logger, container } from '../../infrastructure/utils';
import { AccountType, Currency } from '../models/types';
import { AccountingService } from './accounting.service';
import { AccountName } from '../models/account';

export interface CategoryOptions {
  primaryCategory: string;
  alternativeCategory: string;
  suggestedNewCategory: string;
}

export interface ParsedExpenseData {
  amount: number;
  currency: string;
  description: string;
  category: string;
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
      const expenseAccounts = this.accountingService.getAllAccountNames();

      const prompt = `Please help categorize this merchant based on the following information:

Merchant Name: ${merchant}
Additional Information: ${additionalInfo}

Available categories are:
${expenseAccounts.join('\n')}

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

  async parseExpenseInput(input: string): Promise<ParsedExpenseData> {
    try {
      const prompt = `Please parse the following expense information and create a transaction record:
"${input}"

Please extract the following information:
1. Amount (number)
2. Currency (string, must be one of: ${Object.values(Currency).join(', ')}, if no currency specified, return "SGD")
3. Description (string)
4. Category (string, must be one of: ${Object.values(AccountName).filter(acc => acc.startsWith('Expenses:')).join(', ')})

Please respond with ONLY a clean JSON object in this exact format, without any markdown formatting or additional text:
{
  "amount": number,
  "currency": "string",
  "description": "string",
  "category": "string"
}`;

      const response = await this.openaiAdapter.processMessage(prompt, '');
      return JSON.parse(response);
    } catch (error) {
      logger.error('Error parsing expense input:', error);
      throw error;
    }
  }
}