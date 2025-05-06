import { Context, Telegraf } from 'telegraf';
import { BaseCommandHandler } from './base-command-handler';
import { BeancountQueryService } from '../../beancount/beancount-query.service';
import { container } from '../../utils';
import { formatQueryResult } from '../../utils/query-result-formatter';
import { NLPService } from '../../../domain/services/nlp.service';
import { TextMessage } from '../types';

export class CustomQueryCommandHandler extends BaseCommandHandler {
  private bot: Telegraf;
  private beancountService: BeancountQueryService;
  private nlpService: NLPService;

  constructor(bot: Telegraf) {
    super();
    this.bot = bot;
    this.beancountService = container.getByClass(BeancountQueryService);
    this.nlpService = container.getByClass(NLPService);
  }

  async handle(ctx: Context, ...args: any[]): Promise<boolean> {
    const message = ctx.message as TextMessage;
    const userId = ctx.from?.id;

    if (!message || !userId) {
      this.logger.warn('Received message without message or userId');
      return false;
    }

    // Only handle messages starting with "查"
    if (!message.text.startsWith('查')) {
      return false;
    }

    this.logger.info(`Processing query from user ${userId}: ${message.text}`);

    try {
      const queryText = message.text;
      
      await ctx.reply('Analyzing your query...');
      this.logger.debug('Starting NLP analysis for query');
      
      // Use NLP service to parse the time range
      const dateRange = await this.nlpService.parseDateRange(queryText);
      
      if (!dateRange) {
        this.logger.warn(`Failed to parse date range from query: ${queryText}`);
        await ctx.reply('Sorry, I couldn\'t understand your query. Please try to be more specific, for example: "查last 3 days", "查last week", "查last month"');
        return true;
      }

      this.logger.info(`Parsed date range: ${dateRange.startDate} to ${dateRange.endDate}`);
      await ctx.reply(`Querying transactions for ${queryText}...`);
      
      this.logger.debug('Querying beancount service');
      const result = await this.beancountService.queryByDateRange(dateRange.startDate, dateRange.endDate);
      this.logger.info(`Query returned ${result.assets.length} assets and ${result.expenses.length} expense categories`);
      
      const formattedMessage = formatQueryResult(result);
      await ctx.reply(formattedMessage, { parse_mode: 'HTML' });
      return true;
    } catch (error) {
      this.logger.error('Error processing query:', error);
      await ctx.reply('Sorry, I encountered an error while processing your query.');
      return true;
    }
  }
} 