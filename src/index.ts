import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { promises as fs } from 'fs';
import cron from 'node-cron';
import { GmailAdapter, GmailCredentials, GmailTokens } from './infrastructure/gmail/gmail.adapter';
import { OpenAIAdapter } from './infrastructure/openai/openai.adapter';
import { NLPService } from './domain/services/nlp.service';
import { BeancountService } from './domain/services/beancount.service';
import { AccountingService } from './domain/services/accounting.service';
import { AutomationService } from './application/services/automation.service';
import { BillParserService } from './domain/services/bill-parser.service';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Initialize OpenAI adapter
    const openaiAdapter = new OpenAIAdapter(process.env.OPENAI_API_KEY || '');
    
    // Initialize NLP service
    const nlpService = new NLPService(openaiAdapter);
    
    // Initialize Beancount service
    const beancountService = new BeancountService(process.env.BEANCOUNT_FILE_PATH || '');
    
    // Initialize Accounting service
    const accountingService = new AccountingService(beancountService);
    
    // Load Gmail credentials and tokens
    const credentials = await GmailAdapter.loadCredentials(process.env.GMAIL_CREDENTIALS_PATH || '');

    let tokens: GmailTokens;
    try {
      tokens = JSON.parse(
        await fs.readFile(process.env.GMAIL_TOKENS_PATH || '', 'utf-8')
      );
    } catch (error) {
      console.log('No token.json found. Initializing Gmail authentication...');
      const gmailAdapter = new GmailAdapter(credentials, {
        access_token: '',
        refresh_token: '',
        scope: '',
        token_type: '',
        expiry_date: 0
      });
      
      const authUrl = gmailAdapter.generateAuthUrl();
      console.log('Please visit this URL to authorize the application:');
      console.log(authUrl);
      
      tokens = await gmailAdapter.getInitialTokens();
      console.log('Gmail authentication successful!');
    }
    
    // Initialize Gmail adapter
    const gmailAdapter = new GmailAdapter(credentials, tokens);
    await gmailAdapter.init();
    
    const billParserService = new BillParserService();
    
    // Initialize Automation service
    const automationService = new AutomationService(
      gmailAdapter,
      billParserService,
      accountingService
    );
    
    // Initialize Telegram bot
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
    
    
    // Schedule Gmail bill check every 2 hours
    // cron.schedule('0 */2 * * *', async () => {
    console.log('Running scheduled Gmail bill check...');
    try {
      await automationService.scheduledCheck();
    } catch (error) {
      console.error('Error in scheduled Gmail bill check:', error);
    }
    // });
    
    // Basic command handler
    bot.command('start', (ctx) => {
      ctx.reply('Welcome to BeanTalk! Your personal finance assistant.');
    });
    
    console.log('Starting bot...');
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