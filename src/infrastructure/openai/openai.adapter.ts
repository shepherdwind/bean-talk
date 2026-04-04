import OpenAI from 'openai';
import { logger } from '../utils/logger';

export interface OpenAIAdapterOptions {
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export class OpenAIAdapter {
  private openai: OpenAI;
  private model: string;

  constructor(options: OpenAIAdapterOptions) {
    this.openai = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
    this.model = options.model || 'gpt-4o-mini';
  }

  async processMessage(systemPrompt: string, userMessage: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3, // Lower temperature for more consistent output
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Error calling OpenAI API:', error);
      throw error;
    }
  }
}