import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Initialize Telegram bot
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
    
    // Basic command handler
    bot.command('start', (ctx) => {
      ctx.reply('Welcome to BeanTalk! Your personal finance assistant.');
    });

    // Start the bot
    await bot.launch();
    console.log('BeanTalk bot is running...');

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    console.error('Failed to start the application:', error);
    process.exit(1);
  }
}

main(); 