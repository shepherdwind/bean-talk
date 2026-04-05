import { Bot, InlineKeyboard } from 'grammy';
import { BeancountQueryService } from '../../beancount/beancount-query.service';
import { container, Logger } from '../../utils';
import { ILogger } from '../../utils';
import { formatQueryResult } from '../../utils/query-result-formatter';
import { BotContext } from '../grammy-types';

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

export class QueryCommandHandler {
  private bot: Bot<BotContext>;
  private beancountService: BeancountQueryService;
  private logger: ILogger;

  constructor(bot: Bot<BotContext>) {
    this.bot = bot;
    this.beancountService = container.getByClass(BeancountQueryService);
    this.logger = container.getByClass(Logger);
  }

  registerCallbackHandlers(): void {
    const timeRangeValues = Object.values(TimeRange);
    this.bot.callbackQuery(timeRangeValues, async (ctx) => {
      try {
        const timeRange = ctx.callbackQuery.data as TimeRange;
        await this.handleTimeRange(ctx, timeRange);
        await ctx.answerCallbackQuery();
      } catch (error) {
        this.logger.error('Error handling time range selection:', error);
        await ctx.reply('Sorry, I encountered an error while processing your selection.');
      }
    });
  }

  async handle(ctx: BotContext): Promise<void> {
    const keyboard = new InlineKeyboard()
      .text(TimeRangeDisplayText[TimeRange.TODAY], TimeRange.TODAY)
      .text(TimeRangeDisplayText[TimeRange.YESTERDAY], TimeRange.YESTERDAY)
      .row()
      .text(TimeRangeDisplayText[TimeRange.THIS_WEEK], TimeRange.THIS_WEEK)
      .text(TimeRangeDisplayText[TimeRange.LAST_WEEK], TimeRange.LAST_WEEK)
      .row()
      .text(TimeRangeDisplayText[TimeRange.THIS_MONTH], TimeRange.THIS_MONTH)
      .text(TimeRangeDisplayText[TimeRange.LAST_MONTH], TimeRange.LAST_MONTH);

    await ctx.reply('Please select a time range:', { reply_markup: keyboard });
  }

  private async handleTimeRange(ctx: BotContext, timeRange: TimeRange): Promise<void> {
    switch (timeRange) {
      case TimeRange.TODAY: return this.handleToday(ctx);
      case TimeRange.YESTERDAY: return this.handleYesterday(ctx);
      case TimeRange.THIS_WEEK: return this.handleThisWeek(ctx);
      case TimeRange.LAST_WEEK: return this.handleLastWeek(ctx);
      case TimeRange.THIS_MONTH: return this.handleThisMonth(ctx);
      case TimeRange.LAST_MONTH: return this.handleLastMonth(ctx);
    }
  }

  private async processQuery(ctx: BotContext, startDate: Date, endDate: Date, timeRange: TimeRange): Promise<void> {
    try {
      const adjustedStartDate = new Date(startDate);
      adjustedStartDate.setDate(adjustedStartDate.getDate() - 1);
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

      await ctx.reply(`Querying transactions for ${TimeRangeDisplayText[timeRange]}...`);
      const result = await this.beancountService.queryByDateRange(adjustedStartDate, adjustedEndDate);
      const formattedMessage = formatQueryResult(result);
      await ctx.reply(formattedMessage, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error('Error processing query:', error);
      await ctx.reply('Sorry, I encountered an error while processing your query.');
    }
  }

  private async handleToday(ctx: BotContext): Promise<void> {
    const today = new Date();
    await this.processQuery(ctx, today, today, TimeRange.TODAY);
  }

  private async handleYesterday(ctx: BotContext): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await this.processQuery(ctx, yesterday, yesterday, TimeRange.YESTERDAY);
  }

  private async handleThisWeek(ctx: BotContext): Promise<void> {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    await this.processQuery(ctx, startOfWeek, endOfWeek, TimeRange.THIS_WEEK);
  }

  private async handleLastWeek(ctx: BotContext): Promise<void> {
    const today = new Date();
    const startOfLastWeek = new Date(today);
    startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
    await this.processQuery(ctx, startOfLastWeek, endOfLastWeek, TimeRange.LAST_WEEK);
  }

  private async handleThisMonth(ctx: BotContext): Promise<void> {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    await this.processQuery(ctx, startOfMonth, endOfMonth, TimeRange.THIS_MONTH);
  }

  private async handleLastMonth(ctx: BotContext): Promise<void> {
    const today = new Date();
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    await this.processQuery(ctx, startOfLastMonth, endOfLastMonth, TimeRange.LAST_MONTH);
  }
}
