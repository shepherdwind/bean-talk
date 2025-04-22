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
        this.messageQueue.completeTask(data.merchantId);
        if (!data.selectedCategory) {
          logger.info(`Skipping categorization for merchant: ${data.merchant}`, {
            merchantId: data.merchantId,
            timestamp: data.timestamp,
          });
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
      }
    );

    // Setup queue event handlers
    this.eventEmitter.on(
      getQueueEventName(EventTypes.MERCHANT_NEEDS_CATEGORIZATION),
      async (data: MerchantCategorizationEvent) => {
        try {
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
