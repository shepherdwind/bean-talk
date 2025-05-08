import { EventEmitter } from "events";
import { logger } from "../utils/logger";
import { getQueueEventName } from "./event-types";
import { container } from "../utils";
import { AutomationService } from "../../application/services/automation.service";

interface QueueItem {
  event: string;
  data: any;
  timestamp: number;
  taskId?: string;
}

export class MessageQueueService {
  private queue: QueueItem[] = [];
  private isProcessing: boolean = false;
  private eventEmitter: EventEmitter;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }

  public enqueue(event: string, data: any, taskId?: string): void {
    // Skip if taskId already exists in queue
    if (taskId && this.queue.some(item => item.taskId === taskId)) {
      logger.debug(`Skipping enqueue for duplicate taskId: ${taskId}`);
      return;
    }

    const item: QueueItem = {
      event,
      data,
      timestamp: Date.now(),
      taskId,
    };

    this.queue.push(item);
    logger.debug(`Enqueued event: ${event}`, {
      queueLength: this.queue.length,
    });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  public completeTask(taskId: string): void {
    this.isProcessing = false;
    
    // Find the index of the task with matching taskId
    const taskIndex = this.queue.findIndex(item => item.taskId === taskId);
    
    if (taskIndex === -1) {
      logger.debug(`No task found with ID: ${taskId}`);
      return;
    }

    // Remove the specific task from the queue
    this.queue.splice(taskIndex, 1);
    logger.debug(`Task completed with ID: ${taskId}`, {
      remainingQueueLength: this.queue.length
    });

    // Trigger queue processing if there are items in the queue
    if (this.queue.length > 0 && !this.isProcessing) {
      logger.debug(
        `Triggering queue processing after task completion: ${taskId}`
      );
      this.processQueue();
      return;
    }

    logger.debug(`Queue is empty`);
    const automationService = container.getByClass(AutomationService);
    automationService.scheduledCheck();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    const item = this.queue[0];
    const queueEventName = getQueueEventName(item.event);

    logger.debug(`Processing event: ${queueEventName}`, {
      queueLength: this.queue.length,
      timestamp: new Date(item.timestamp).toISOString(),
    });

    try {
      await this.processEvent(queueEventName, item.data);
      logger.debug(`Successfully processed event: ${queueEventName}`, {
        remainingQueueLength: this.queue.length,
      });
    } catch (error) {
      logger.error(`Error processing event ${queueEventName}:`, error);
    }
  }

  private async processEvent(eventName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventEmitter.emit(eventName, data, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public isQueueProcessing(): boolean {
    return this.isProcessing;
  }

  public clearTasksByMerchant(merchant: string): void {
    // Remove all tasks that have the merchant name in their data
    this.queue = this.queue.filter(item => {
      if (item.data && item.data.merchant) {
        return item.data.merchant !== merchant;
      }
      return true;
    });
    logger.debug(`Cleared tasks for merchant: ${merchant}`, {
      remainingQueueLength: this.queue.length,
    });
  }
}
