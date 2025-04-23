import { Context, Telegraf } from 'telegraf';
import { BaseCommandHandler } from './base-command-handler';
import { Markup } from 'telegraf';
import { BeancountQueryService } from '../../beancount/beancount-query.service';
import { container } from '../../utils';
import { formatQueryResult } from '../../utils/query-result-formatter';

export enum TimeRange {
  TODAY = 'query_today',
  YESTERDAY = 'query_yesterday',
  THIS_WEEK = 'query_this_week',
  LAST_WEEK = 'query_last_week',
  THIS_MONTH = 'query_this_month',
  LAST_MONTH = 'query_last_month'
}

const TimeRangeDisplayText: Record<TimeRange, string> = {
  [TimeRange.TODAY]: 'Today',
  [TimeRange.YESTERDAY]: 'Yesterday',
  [TimeRange.THIS_WEEK]: 'This Week',
  [TimeRange.LAST_WEEK]: 'Last Week',
  [TimeRange.THIS_MONTH]: 'This Month',
  [TimeRange.LAST_MONTH]: 'Last Month'
};

export class QueryCommandHandler extends BaseCommandHandler {
  private bot: Telegraf;
  private beancountService: BeancountQueryService;

  constructor(bot: Telegraf) {
    super();
    this.bot = bot;
    this.beancountService = container.getByClass(BeancountQueryService);
    this.setupActionHandlers();
  }

  private setupActionHandlers(): void {
    this.bot.action(Object.values(TimeRange), async (ctx: Context) => {
      try {
        const timeRange = (ctx.callbackQuery as any).data as TimeRange;
        await this.handleTimeRange(ctx, timeRange);
        await ctx.answerCbQuery();
      } catch (error) {
        console.error('Error handling time range selection:', error);
        await ctx.reply('Sorry, I encountered an error while processing your selection.');
      }
    });
  }

  async handle(ctx: Context, ...args: any[]): Promise<void> {
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(TimeRangeDisplayText[TimeRange.TODAY], TimeRange.TODAY),
        Markup.button.callback(TimeRangeDisplayText[TimeRange.YESTERDAY], TimeRange.YESTERDAY)
      ],
      [
        Markup.button.callback(TimeRangeDisplayText[TimeRange.THIS_WEEK], TimeRange.THIS_WEEK),
        Markup.button.callback(TimeRangeDisplayText[TimeRange.LAST_WEEK], TimeRange.LAST_WEEK)
      ],
      [
        Markup.button.callback(TimeRangeDisplayText[TimeRange.THIS_MONTH], TimeRange.THIS_MONTH),
        Markup.button.callback(TimeRangeDisplayText[TimeRange.LAST_MONTH], TimeRange.LAST_MONTH)
      ]
    ]);

    await ctx.reply('Please select a time range:', keyboard);
  }

  async handleTimeRange(ctx: Context, timeRange: TimeRange): Promise<void> {
    switch (timeRange) {
      case TimeRange.TODAY:
        await this.handleToday(ctx);
        break;
      case TimeRange.YESTERDAY:
        await this.handleYesterday(ctx);
        break;
      case TimeRange.THIS_WEEK:
        await this.handleThisWeek(ctx);
        break;
      case TimeRange.LAST_WEEK:
        await this.handleLastWeek(ctx);
        break;
      case TimeRange.THIS_MONTH:
        await this.handleThisMonth(ctx);
        break;
      case TimeRange.LAST_MONTH:
        await this.handleLastMonth(ctx);
        break;
    }
  }

  private async processQuery(ctx: Context, startDate: Date, endDate: Date, timeRange: TimeRange): Promise<void> {
    try {
      // Adjust dates to include the full range
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setDate(adjustedStartDate.getDate() - 1);
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

      await ctx.reply(`Querying transactions for ${TimeRangeDisplayText[timeRange]}...`);
      const result = await this.beancountService.queryByDateRange(adjustedStartDate, adjustedEndDate);
      const formattedMessage = formatQueryResult(result);
      await ctx.reply(formattedMessage, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error processing query:', error);
      await ctx.reply('Sorry, I encountered an error while processing your query.');
    }
  }

  private async handleToday(ctx: Context): Promise<void> {
    const today = new Date();
    await this.processQuery(ctx, today, today, TimeRange.TODAY);
  }

  private async handleYesterday(ctx: Context): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await this.processQuery(ctx, yesterday, yesterday, TimeRange.YESTERDAY);
  }

  private async handleThisWeek(ctx: Context): Promise<void> {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    await this.processQuery(ctx, startOfWeek, endOfWeek, TimeRange.THIS_WEEK);
  }

  private async handleLastWeek(ctx: Context): Promise<void> {
    const today = new Date();
    const startOfLastWeek = new Date(today);
    startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
    await this.processQuery(ctx, startOfLastWeek, endOfLastWeek, TimeRange.LAST_WEEK);
  }

  private async handleThisMonth(ctx: Context): Promise<void> {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    await this.processQuery(ctx, startOfMonth, endOfMonth, TimeRange.THIS_MONTH);
  }

  private async handleLastMonth(ctx: Context): Promise<void> {
    const today = new Date();
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    await this.processQuery(ctx, startOfLastMonth, endOfLastMonth, TimeRange.LAST_MONTH);
  }
} 