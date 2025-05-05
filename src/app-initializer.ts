import cron from 'node-cron';
import { GmailAdapter } from './infrastructure/gmail/gmail.adapter';
import { OpenAIAdapter } from './infrastructure/openai/openai.adapter';
import { NLPService } from './domain/services/nlp.service';
import { BeancountService } from './domain/services/beancount.service';
import { AccountingService } from './domain/services/accounting.service';
import { AutomationService } from './application/services/automation.service';
import { BillParserService } from './domain/services/bill-parser.service';
import { logger, container, Logger } from './infrastructure/utils/index';
import { EmailParserFactory } from './infrastructure/email-parsers';
import { TelegramAdapter } from './infrastructure/telegram/telegram.adapter';
import { EventListenerService } from './infrastructure/events/event-listener.service';
import { ApplicationEventEmitter } from './infrastructure/events/event-emitter';
import { BeancountQueryService } from './infrastructure/beancount/beancount-query.service';

/**
 * 初始化依赖注入容器和基础服务
 */
export async function initializeContainer(): Promise<void> {
  logger.info('Initializing dependency injection container...');
  
  // Register the logger by class name
  container.registerClass(Logger, logger);
  
  // Register ApplicationEventEmitter
  const eventEmitter = new ApplicationEventEmitter();
  container.registerClass(ApplicationEventEmitter, eventEmitter);
  
  // Initialize and register EventListenerService
  const eventListenerService = new EventListenerService();
  container.registerClass(EventListenerService, eventListenerService);

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

  // Register BeancountQueryService with hardcoded path
  const beancountQueryService = new BeancountQueryService();
  container.registerClass(BeancountQueryService, beancountQueryService);

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
  const gmailAdapter = await GmailAdapter.initialize();
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
  const cronSchedule = process.env.CRON_SCHEDULE || '*/30 * * * *';
  cron.schedule(cronSchedule, async () => {
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