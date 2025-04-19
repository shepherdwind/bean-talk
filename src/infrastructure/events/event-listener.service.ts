import { ApplicationEventEmitter, MerchantCategorizationEvent } from './event-emitter';
import { TelegramAdapter } from '../telegram/telegram.adapter';
import { container } from '../utils';
import { logger } from '../utils/logger';

interface MerchantCategorySelectedEvent {
  merchantId: string;
  merchant: string;
  selectedCategory: string;
  timestamp: string;
}

export class EventListenerService {
  constructor() {
    this.setupEventListeners();
  }

  private get eventEmitter(): ApplicationEventEmitter {
    return container.getByClass(ApplicationEventEmitter);
  }

  private get telegramAdapter(): TelegramAdapter {
    return container.getByClass(TelegramAdapter);
  }

  private setupEventListeners(): void {
    this.eventEmitter.on('merchantNeedsCategorization', async (data: MerchantCategorizationEvent) => {
      try {
        let message = `🔍 New Merchant Needs Categorization\n\n` +
          `🏪 Merchant: ${data.merchant}\n` +
          `⏰ Time: ${new Date(data.timestamp).toLocaleString()}\n\n`;
        
        // Add email information if available
        if (data.email) {
          message += `📧 Email Details:\n` +
            `📝 Subject: ${data.email.subject}\n` +
            `📨 From: ${data.email.from}\n`;
          
          if (data.email.date) {
            message += `📅 Date: ${data.email.date}\n`;
          }
        }
        
        message += `\nPlease update the merchant category mapping in the configuration or use AI assistance.`;

        await this.telegramAdapter.sendNotification(message, data.merchantId, data);
        logger.info(`Sent notification for merchant categorization: ${data.merchant}`);
      } catch (error) {
        logger.error('Error sending merchant categorization notification:', error);
      }
    });

    this.eventEmitter.on('merchantCategorySelected', async (data: MerchantCategorySelectedEvent) => {
      try {
        // Here you would implement the logic to save the category
        // For example, updating a database or configuration file
        logger.info(`Saving category for merchant: ${data.merchant}`, {
          merchantId: data.merchantId,
          selectedCategory: data.selectedCategory,
          timestamp: data.timestamp
        });

        // TODO: Implement the actual saving logic here
        // This could involve:
        // 1. Updating a database
        // 2. Updating a configuration file
        // 3. Making an API call to another service
        // 4. etc.

      } catch (error) {
        logger.error('Error saving merchant category:', error);
      }
    });
  }
} 