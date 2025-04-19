import { Transaction } from '../models/transaction';
import { Account } from '../models/account';
import { Amount, Currency } from '../models/types';
import { OpenAIAdapter } from '../../infrastructure/openai/openai.adapter';
import { logger } from '../../infrastructure/utils/logger';

export class NLPService {
  constructor(private openaiAdapter: OpenAIAdapter) {}

  async parseBillText(text: string): Promise<Transaction | null> {
    try {
      const systemPrompt = `You are a financial assistant that helps parse bill information from text.
Your task is to extract the following information from the bill text:
1. Transaction date
2. Description
3. Amount and currency
4. Account names (from the list of available accounts)

Available accounts:
${this.getAvailableAccounts()}

Return the information in JSON format with the following structure:
{
  "date": "YYYY-MM-DD",
  "description": "string",
  "entries": [
    {
      "account": "string (account name)",
      "amount": {
        "value": number,
        "currency": "string (currency code)"
      }
    }
  ]
}`;

      const response = await this.openaiAdapter.processMessage(systemPrompt, text);
      
      try {
        const parsedResponse = JSON.parse(response);
        
        // Validate and convert the response
        if (!this.isValidTransactionFormat(parsedResponse)) {
          logger.error('Invalid transaction format from OpenAI response');
          return null;
        }

        // Convert string date to Date object
        const transaction: Transaction = {
          ...parsedResponse,
          date: new Date(parsedResponse.date),
          metadata: {
            source: 'email',
            parsedAt: new Date().toISOString(),
          },
        };

        return transaction;
      } catch (error) {
        logger.error('Error parsing OpenAI response:', error);
        return null;
      }
    } catch (error) {
      logger.error('Error in parseBillText:', error);
      return null;
    }
  }

  private getAvailableAccounts(): string {
    // This should be replaced with actual account loading logic
    return `
Assets:
- Assets:Cash
- Assets:Bank:Checking
- Assets:Bank:Savings
- Assets:Alipay
- Assets:WeChat

Expenses:
- Expenses:Food
- Expenses:Transport
- Expenses:Shopping
- Expenses:Utilities
- Expenses:Entertainment
    `.trim();
  }

  private isValidTransactionFormat(data: any): boolean {
    if (!data.date || !data.description || !Array.isArray(data.entries)) {
      return false;
    }

    for (const entry of data.entries) {
      if (!entry.account || !entry.amount || 
          typeof entry.amount.value !== 'number' || 
          !entry.amount.currency) {
        return false;
      }
    }

    return true;
  }
}