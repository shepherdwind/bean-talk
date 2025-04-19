import { promises as fs } from 'fs';
import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { GmailAdapter, GmailCredentials, GmailTokens } from './infrastructure/gmail/gmail.adapter';
import { OpenAIAdapter } from './infrastructure/openai/openai.adapter';
import { NLPService } from './domain/services/nlp.service';
import { BeancountService } from './domain/services/beancount.service';
import { AccountingService } from './domain/services/accounting.service';
import { AutomationService } from './application/services/automation.service';
import { BillParserService } from './domain/services/bill-parser.service';
import { logger, container, Logger } from './infrastructure/utils/index';
import { EmailParserFactory } from './infrastructure/email-parsers';
import { TelegramAdapter } from './infrastructure/telegram/telegram.adapter';

/**
 * 初始化依赖注入容器和基础服务
 */
export async function initializeContainer(): Promise<void> {
  logger.info('Initializing dependency injection container...');
  
  // Register the logger by class name
  container.registerClass(Logger, logger);
  
  // Initialize OpenAI adapter and register it with Class
  const openaiAdapter = new OpenAIAdapter(process.env.OPENAI_API_KEY || '');
  container.registerClass(OpenAIAdapter, openaiAdapter);
  
  // Register the EmailParserFactory with Class
  const emailParserFactory = new EmailParserFactory();
  container.registerClass(EmailParserFactory, emailParserFactory);

  // Register domain services
  container.registerClassFactory(BeancountService, () => {
    return new BeancountService(process.env.BEANCOUNT_FILE_PATH || '');
  });

  // Register NLPService
  container.registerClassFactory(NLPService, () => new NLPService());

  // Register AccountingService 
  container.registerClassFactory(AccountingService, () => new AccountingService());
  
  // Register BillParserService
  container.registerClassFactory(BillParserService, () => new BillParserService());
  
  // Register TelegramAdapter
  const telegramAdapter = new TelegramAdapter();
  container.registerClass(TelegramAdapter, telegramAdapter);
  
  logger.info('Container initialization completed');
}

/**
 * 初始化Gmail适配器
 * @returns 初始化成功的Gmail适配器实例
 */
export async function setupGmailAdapter(): Promise<GmailAdapter> {
  logger.info('Setting up Gmail adapter...');
  
  // Load Gmail credentials and tokens
  const credentials = await GmailAdapter.loadCredentials(process.env.GMAIL_CREDENTIALS_PATH || '');

  let tokens: GmailTokens;
  try {
    tokens = JSON.parse(
      await fs.readFile(process.env.GMAIL_TOKENS_PATH || '', 'utf-8')
    );
  } catch (error) {
    logger.info('No token.json found. Initializing Gmail authentication...');
    const gmailAdapter = new GmailAdapter(credentials, {
      access_token: '',
      refresh_token: '',
      scope: '',
      token_type: '',
      expiry_date: 0
    });
    
    const authUrl = gmailAdapter.generateAuthUrl();
    logger.info('Please visit this URL to authorize the application:');
    logger.info(authUrl);
    
    tokens = await gmailAdapter.getInitialTokens();
    logger.info('Gmail authentication successful!');
  }
  
  // Initialize Gmail adapter and register it
  const gmailAdapter = new GmailAdapter(credentials, tokens);
  await gmailAdapter.init();
  container.registerClass(GmailAdapter, gmailAdapter);
  
  logger.info('Gmail adapter setup completed');
  return gmailAdapter;
}

/**
 * 设置自动化任务，包括定时检查
 */
export async function setupAutomation(): Promise<void> {
  logger.info('Setting up automation tasks...');
  
  // Register the Automation service
  container.registerClassFactory(AutomationService, () => new AutomationService());
  
  // Run scheduled task once at startup
  logger.info('Running initial Gmail bill check...');
  try {
    // Get service by class
    const automationService = container.getByClass(AutomationService);
    await automationService.scheduledCheck();
  } catch (error) {
    logger.error('Error in initial Gmail bill check:', error);
  }
  
  // Set up cron job for regular checks
  logger.info('Setting up scheduled Gmail bill check cron job...');
  cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled Gmail bill check...');
    try {
      const automationService = container.getByClass(AutomationService);
      await automationService.scheduledCheck();
    } catch (error) {
      logger.error('Error in scheduled Gmail bill check:', error);
    }
  });
  
  logger.info('Automation tasks setup completed');
}

/**
 * 设置Telegram机器人
 * @returns 初始化好的Telegram机器人实例
 */
export async function setupTelegramBot(): Promise<Telegraf> {
  logger.info('Setting up Telegram bot...');
  
  // Initialize Telegram bot
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
  
  // Basic command handler
  bot.command('start', (ctx) => {
    ctx.reply('Welcome to BeanTalk! Your personal finance assistant.');
  });
  
  // Start the bot
  logger.info('Starting bot...');
  await bot.launch();
  logger.info('BeanTalk bot is running...');
  
  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
  
  return bot;
} 