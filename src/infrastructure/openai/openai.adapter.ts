import OpenAI from 'openai';
import { logger } from '../utils/logger';

export class OpenAIAdapter {
  private openai: OpenAI;

  constructor(private apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async processMessage(systemPrompt: string, userMessage: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
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