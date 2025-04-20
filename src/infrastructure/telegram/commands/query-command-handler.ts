import { Context } from 'telegraf';
import { BaseCommandHandler } from './base-command-handler';

export class QueryCommandHandler extends BaseCommandHandler {
  async handle(ctx: Context, ...args: any[]): Promise<void> {
    // This will be implemented when adding query-related commands
    await ctx.reply('Query commands are not implemented yet.');
  }
} 