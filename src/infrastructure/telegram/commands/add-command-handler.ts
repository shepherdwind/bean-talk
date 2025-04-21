import { Context } from 'telegraf';
import { BaseCommandHandler } from './base-command-handler';

export class AddCommandHandler extends BaseCommandHandler {
  async handle(ctx: Context, ...args: any[]): Promise<void> {
    // This will be implemented when adding bill-related commands
    await ctx.reply('Add bill command is not implemented yet.');
  }
} 