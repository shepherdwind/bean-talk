import dotenv from 'dotenv';
import { logger, container, Logger } from './infrastructure/utils';
import { 
  initializeContainer, 
  setupGmailAdapter, 
  setupAutomation, 
  setupTelegramBot 
} from './app-initializer';

// Load environment variables
dotenv.config();

/**
 * 主函数，应用入口点
 */
async function main() {
  try {
    logger.info('Starting BeanTalk application...');
    
    // 初始化依赖注入容器
    await initializeContainer();
    
    // 设置Gmail适配器
    await setupGmailAdapter();
    
    // 设置自动化任务
    await setupAutomation();
    
    // 设置Telegram机器人
    await setupTelegramBot();
    
    logger.info('BeanTalk application started successfully');
  } catch (error) {
    logger.error('Failed to start the application:', error);
    process.exit(1);
  }
}

main(); 