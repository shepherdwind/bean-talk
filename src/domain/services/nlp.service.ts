import { OpenAIAdapter } from '../../infrastructure/openai/openai.adapter';
import { logger, container } from '../../infrastructure/utils';
import { AccountType, Currency } from '../models/types';
import { AccountingService } from './accounting.service';
import { AccountName } from '../models/account';

export interface CategorySuggestions {
  primary: string;
  alternative: string;
}

export interface AutoCategoryResult {
  category: string;
  confidence: number;
  suggestions: CategorySuggestions;
}

export interface ParsedExpenseData {
  amount: number;
  currency: string;
  description: string;
  category: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export class NLPService {
  private openaiAdapter: OpenAIAdapter;
  private accountingService: AccountingService;

  constructor(openaiAdapter?: OpenAIAdapter, accountingService?: AccountingService) {
    // 如果提供了直接依赖，使用它；否则从容器通过类名获取
    this.openaiAdapter = openaiAdapter || container.getByClass(OpenAIAdapter);
    this.accountingService = accountingService || container.getByClass(AccountingService);
  }

  async categorizeMerchantWithContext(merchant: string, additionalInfo: string): Promise<CategorySuggestions> {
    try {
      const expenseAccounts = this.accountingService.getAllAccountNames()
        .filter(name => name.startsWith('Expenses:'));

      const systemPrompt = `You are a financial transaction categorizer. Given a merchant name and additional context, pick the TWO best matching categories from the list below.

Available expense categories:
${expenseAccounts.join('\n')}

Respond with ONLY a JSON object in this exact format, no other text:
{"primary": "best matching category", "alternative": "second best category"}

Rules:
- primary and alternative MUST be exactly from the provided list above, copy character-for-character
- primary and alternative MUST be different categories
- DO NOT invent, create, or suggest new categories — only use what is in the list`;

      const response = await this.openaiAdapter.processMessage(systemPrompt, `Merchant: ${merchant}\nAdditional info: ${additionalInfo}`);
      logger.debug(`AI categorize-with-context response for "${merchant}": ${response}`);
      const jsonMatch = response.match(/\{.*\}/s);
      if (!jsonMatch) {
        logger.warn(`No JSON found in AI response for "${merchant}"`);
        return { primary: '', alternative: '' };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        primary: parsed.primary || '',
        alternative: parsed.alternative || '',
      };
    } catch (error) {
      logger.error('Error categorizing merchant with context:', error);
      throw error;
    }
  }

  async autoCategorizeMerchant(merchant: string): Promise<AutoCategoryResult> {
    try {
      const expenseAccounts = this.accountingService.getAllAccountNames()
        .filter(name => name.startsWith('Expenses:'));

      const systemPrompt = `You are a financial transaction categorizer. Given a merchant name, pick the TWO best matching categories from the list below.

Available expense categories:
${expenseAccounts.join('\n')}

Respond with ONLY a JSON object in this exact format, no other text:
{"primary": "best matching category", "alternative": "second best category", "confidence": 0.95}

Rules:
- confidence is a number between 0 and 1 for how sure you are about the primary category
- Use 0.9+ for well-known merchants where the category is obvious
- Use 0.5-0.8 for ambiguous merchants where the category is a guess
- Use below 0.5 for completely unclear merchants
- primary and alternative MUST be exactly from the provided list above, copy character-for-character
- primary and alternative MUST be different categories
- DO NOT invent, create, or suggest new categories — only use what is in the list`;

      const response = await this.openaiAdapter.processMessage(systemPrompt, `Categorize this merchant: ${merchant}`);
      logger.debug(`AI auto-categorize response for "${merchant}": ${response}`);
      const jsonMatch = response.match(/\{.*\}/s);
      if (!jsonMatch) {
        logger.warn(`No JSON found in AI response for "${merchant}"`);
        return { category: '', confidence: 0, suggestions: { primary: '', alternative: '' } };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      logger.debug(`AI auto-categorize parsed for "${merchant}": ${JSON.stringify(parsed)}`);
      return {
        category: parsed.primary || '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        suggestions: {
          primary: parsed.primary || '',
          alternative: parsed.alternative || '',
        },
      };
    } catch (error) {
      logger.error('Error auto-categorizing merchant:', error);
      return { category: '', confidence: 0, suggestions: { primary: '', alternative: '' } };
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

  async parseDateRange(text: string): Promise<DateRange | null> {
    try {
      const currentDate = new Date();
      logger.info(`Parsing date range for input: "${text}"`);
      logger.info(`Current date (local): ${currentDate.toLocaleString()}`);

      const prompt = `You are a helpful assistant that parses natural language time ranges into specific dates.
      The current date is ${currentDate.toLocaleString()}.
      You must respond with ONLY a JSON object containing startDate and endDate in ISO format.
      Do not include any other text, explanations, or markdown formatting.
      
      Important rules for time ranges:
      1. For "yesterday", the end date should be the end of yesterday (23:59:59.999)
      2. For "today", the end date should be the current time
      3. For ranges like "last week", the end date should be the end of the last day (23:59:59.999)
      4. For future dates, use the end of the day (23:59:59.999)
      5. For "last N days" (e.g., "last 3 days"), start from N days ago and end at current time
      
      For example:
      - If input is "yesterday", response should be: {"startDate":"2024-03-17T00:00:00.000+08:00","endDate":"2024-03-17T23:59:59.999+08:00"}
      - If input is "today", response should be: {"startDate":"2024-03-18T00:00:00.000+08:00","endDate":"2024-03-18T12:34:56.789+08:00"} (using current time)
      - If input is "last week", response should be: {"startDate":"2024-03-11T00:00:00.000+08:00","endDate":"2024-03-17T23:59:59.999+08:00"}
      - If input is "last 3 days", response should be: {"startDate":"2024-03-15T00:00:00.000+08:00","endDate":"2024-03-18T12:34:56.789+08:00"} (using current time)
      
      Note: Always include the timezone offset (e.g., +08:00 for Singapore time) in the ISO string.
      If you cannot parse the time range, return null.`;

      const response = await this.openaiAdapter.processMessage(prompt, text);
      logger.info(`OpenAI response: ${response}`);

      if (!response) {
        logger.warn('OpenAI returned empty response');
        return null;
      }

      // Remove any non-JSON content
      const jsonMatch = response.match(/\{.*\}/s);
      if (!jsonMatch) {
        logger.warn('No JSON object found in response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      logger.info(`Parsed JSON: ${JSON.stringify(parsed)}`);

      if (!parsed.startDate || !parsed.endDate) {
        logger.warn('Missing startDate or endDate in parsed JSON');
        return null;
      }

      const result = {
        startDate: new Date(parsed.startDate),
        endDate: new Date(new Date(parsed.endDate).setDate(new Date(parsed.endDate).getDate() + 1))
      };
      
      logger.info(`Final date range (local): ${result.startDate.toLocaleString()} to ${result.endDate.toLocaleString()}`);
      return result;
    } catch (error) {
      logger.error('Error parsing date range:', error);
      return null;
    }
  }
}