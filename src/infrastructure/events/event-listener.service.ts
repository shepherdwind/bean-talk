import { ApplicationEventEmitter, MerchantCategorizationEvent } from './event-emitter';
import { TelegramAdapter } from '../telegram/telegram.adapter';
import { container } from '../utils';
import { logger } from '../utils/logger';
import { AccountingService } from '../../domain/services/accounting.service';

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
  
  private get accountingService(): AccountingService {
    return container.getByClass(AccountingService);
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
        // Save the selected category using AccountingService
        this.accountingService.addMerchantToCategory(data.merchant, data.selectedCategory);
        
        logger.info(`Saved category for merchant: ${data.merchant}`, {
          merchantId: data.merchantId,
          selectedCategory: data.selectedCategory,
          timestamp: data.timestamp
        });
      } catch (error) {
        logger.error('Error saving merchant category:', error);
      }
    });
  }
}