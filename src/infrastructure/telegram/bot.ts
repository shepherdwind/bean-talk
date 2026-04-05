import { Bot, session } from 'grammy';
import { conversations } from '@grammyjs/conversations';
import { BotContext, SessionData, createInitialSessionData } from './grammy-types';
import { FileSessionStorage } from './session-storage';
import { TG_ACCOUNTS } from '../utils/telegram';
import { logger } from '../utils/logger';

export interface BotOptions {
  token: string;
  sessionDir: string;
}

export function createBot(options: BotOptions): Bot<BotContext> {
  const bot = new Bot<BotContext>(options.token);

  // Whitelist middleware — drop updates from non-whitelisted users
  bot.use(async (ctx, next) => {
    const username = ctx.from?.username;
    if (!username || !TG_ACCOUNTS.includes(username)) {
      logger.debug(`Ignoring update from non-whitelisted user: ${username}`);
      return;
    }
    return next();
  });

  // Session middleware with file-based persistence
  bot.use(session<SessionData, BotContext>({
    initial: createInitialSessionData,
    storage: new FileSessionStorage<SessionData>(options.sessionDir),
  }));

  // Conversations plugin
  bot.use(conversations());

  // Baseline /start command
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id;
    await ctx.reply(`Welcome to Bean Talk! Use /add to add a bill, /query to view reports.\n\nYour chat ID: <code>${chatId}</code>`, { parse_mode: 'HTML' });
  });

  return bot;
}
