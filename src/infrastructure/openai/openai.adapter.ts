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
      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        stream: true,
      });

      let result = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          result += content;
        }
      }
      return result;
    } catch (error) {
      logger.error('Error calling OpenAI API:', error);
      throw error;
    }
  }
}