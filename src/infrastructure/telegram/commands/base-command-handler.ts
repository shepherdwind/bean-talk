import { Context } from 'telegraf';
import { ILogger, container, Logger } from '../../utils';

export abstract class BaseCommandHandler {
  protected logger: ILogger;

  constructor() {
    this.logger = container.getByClass(Logger);
  }

  abstract handle(ctx: Context, ...args: any[]): Promise<boolean | void>;
} 