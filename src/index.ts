// Load environment variables BEFORE any other imports
// (TokenManager uses process.env at module load time)
import dotenv from 'dotenv';
dotenv.config();

import { logger, container } from './infrastructure/utils';
import {
  initializeContainer,
  setupGmailAdapter,
  setupAutomation
} from './app-initializer';
import { TelegramAdapter } from './infrastructure/telegram/telegram.adapter';

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

    // 先启动 Telegram bot（Gmail OAuth 授权需要通过 bot 发送链接）
    logger.debug('Initializing Telegram bot...');
    const telegramAdapter = container.getByClass(TelegramAdapter);
    await telegramAdapter.init();
    logger.debug('Telegram bot initialized');

    // 设置 Gmail 适配器
    // 有 credentials 时启动 OAuth 流程（包括 token 过期重授权）
    // 没有 credentials 文件时跳过
    try {
      await setupGmailAdapter();
      await setupAutomation();
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        logger.warn('Gmail credentials file not found — skipping email processing');
      } else {
        // OAuth 失败等其他错误不应静默吞掉，向上抛
        throw error;
      }
    }
    
    logger.info('BeanTalk application started successfully');
  } catch (error) {
    logger.error('Failed to start the application:', error);
    process.exit(1);
  }
}

main(); 