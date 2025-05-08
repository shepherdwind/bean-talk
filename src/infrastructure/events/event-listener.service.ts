import {
  ApplicationEventEmitter,
  MerchantCategorizationEvent,
} from "./event-emitter";
import { TelegramAdapter } from "../telegram/telegram.adapter";
import { container } from "../utils";
import { logger } from "../utils/logger";
import { AccountingService } from "../../domain/services/accounting.service";
import { formatDateToUTC8 } from "../utils/date.utils";
import { MessageQueueService } from "./message-queue.service";
import { EventTypes, getQueueEventName } from "./event-types";
import { getAccountByEmail } from "../utils/telegram";

interface MerchantCategorySelectedEvent {
  merchantId: string;
  merchant: string;
  selectedCategory: string;
  timestamp: string;
}

export class EventListenerService {
  private messageQueue: MessageQueueService;

  constructor() {
    this.messageQueue = new MessageQueueService(this.eventEmitter);
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
    this.eventEmitter.on(
      EventTypes.MERCHANT_NEEDS_CATEGORIZATION,
      async (data: MerchantCategorizationEvent) => {
        // Clear any existing tasks for this merchant before enqueueing new one
        this.messageQueue.clearTasksByMerchant(data.merchant);
        
        // Use merchantId as taskId for tracking
        this.messageQueue.enqueue(
          EventTypes.MERCHANT_NEEDS_CATEGORIZATION,
          data,
          data.merchantId
        );
      }
    );

    this.eventEmitter.on(
      EventTypes.MERCHANT_CATEGORY_SELECTED,
      async (data: MerchantCategorySelectedEvent) => {
        if (!data.selectedCategory) {
          logger.info(`Skipping categorization for merchant: ${data.merchant}`, {
            merchantId: data.merchantId,
            timestamp: data.timestamp,
          });
          this.messageQueue.completeTask(data.merchantId);
          return;
        }

        this.accountingService.addMerchantToCategory(
          data.merchant,
          data.selectedCategory
        );

        logger.info(`Saved category for merchant: ${data.merchant}`, {
          merchantId: data.merchantId,
          selectedCategory: data.selectedCategory,
          timestamp: data.timestamp,
        });
        this.messageQueue.completeTask(data.merchantId);
      }
    );

    // Setup queue event handlers
    this.eventEmitter.on(
      getQueueEventName(EventTypes.MERCHANT_NEEDS_CATEGORIZATION),
      async (data: MerchantCategorizationEvent) => {
        try {
          // Check if merchant already has a category
          const existingCategory = this.accountingService.findCategoryForMerchant(data.merchant);
          if (existingCategory) {
            logger.info(`Merchant ${data.merchant} already has category: ${existingCategory}`);
            this.messageQueue.completeTask(data.merchantId);
            return;
          }

          let message =
            `New Merchant Needs Categorization\n@${getAccountByEmail(data.email?.to)}\n\n` +
            `Merchant: <b>${data.merchant}</b>\n` +
            `Amount: <b>${data.amount?.value} ${data.amount?.currency}</b>\n` +
            `Time: <b>${formatDateToUTC8(data.email?.date)}</b>\n`;

          message += `\nPlease update the merchant category use AI assistance.`;

          await this.telegramAdapter.sendNotification(
            message,
            data.merchantId,
            data
          );
          logger.info(
            `Sent notification for merchant categorization: ${data.merchant}`
          );
        } catch (error) {
          logger.error(
            "Error sending merchant categorization notification:",
            error
          );
        }
      }
    );
  }
}
