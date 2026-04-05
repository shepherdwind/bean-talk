import { Bot } from 'grammy';
import { BeancountQueryService } from '../../beancount/beancount-query.service';
import { container, Logger } from '../../utils';
import { ILogger } from '../../utils';
import { formatQueryResult } from '../../utils/query-result-formatter';
import { NLPService } from '../../../domain/services/nlp.service';
import { formatDateToMMDD } from '../../utils/date.utils';
import { BotContext } from '../grammy-types';

export class CustomQueryCommandHandler {
  private bot: Bot<BotContext>;
  private beancountService: BeancountQueryService;
  private nlpService: NLPService;
  private logger: ILogger;

  constructor(bot: Bot<BotContext>) {
    this.bot = bot;
    this.beancountService = container.getByClass(BeancountQueryService);
    this.nlpService = container.getByClass(NLPService);
    this.logger = container.getByClass(Logger);
  }

  async handle(ctx: BotContext): Promise<boolean> {
    const message = ctx.message;
    const userId = ctx.from?.id;
    const text = message && 'text' in message ? message.text : undefined;

    if (!text || !userId) {
      return false;
    }

    if (!text.startsWith('查')) {
      return false;
    }

    this.logger.info(`Processing query from user ${userId}: ${text}`);

    try {
      await ctx.reply('Analyzing your query...');

      const dateRange = await this.nlpService.parseDateRange(text);

      if (!dateRange) {
        this.logger.warn(`Failed to parse date range from query: ${text}`);
        await ctx.reply('Sorry, I couldn\'t understand your query. Please try to be more specific, for example: "查last 3 days", "查last week", "查last month"');
        return true;
      }

      this.logger.info(`Parsed date range: ${dateRange.startDate} to ${dateRange.endDate}`);

      await ctx.reply(`Querying transactions from ${formatDateToMMDD(dateRange.startDate)} to ${formatDateToMMDD(dateRange.endDate)}...`);

      const result = await this.beancountService.queryByDateRange(dateRange.startDate, dateRange.endDate);
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
