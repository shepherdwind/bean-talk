import dotenv from 'dotenv';
import { logger, container } from './infrastructure/utils';
import { 
  initializeContainer, 
  setupGmailAdapter, 
  setupAutomation
} from './app-initializer';
import { TelegramAdapter } from './infrastructure/telegram/telegram.adapter';

// Load environment variables
dotenv.config();

/**
 * 主函数，应用入口点
 */
async function main() {
  try {
    logger.info('Starting BeanTalk application...');
    
    // Check required environment variables
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      logger.error('TELEGRAM_BOT_TOKEN is required in environment variables');
      process.exit(1);
    }
    
    logger.debug('Environment variables check passed');
    
    // 初始化依赖注入容器
    await initializeContainer();
    
    // 设置Gmail适配器
    await setupGmailAdapter();
    
    // 设置自动化任务
    await setupAutomation();
    
    // 初始化并启动 Telegram 机器人
    logger.debug('Initializing Telegram bot...');
    const telegramAdapter = container.getByClass(TelegramAdapter);
    await telegramAdapter.init();
    logger.debug('Telegram bot initialized');
    
    logger.info('BeanTalk application started successfully');
  } catch (error) {
    logger.error('Failed to start the application:', error);
    process.exit(1);
  }
}

main(); 