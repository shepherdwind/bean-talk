import { EventEmitter } from "events";
import { logger } from "../utils/logger";
import { getQueueEventName } from "./event-types";

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
    // Remove the item from the queue
    this.queue.shift();
    logger.debug(`Task completed with ID: ${taskId}`);

    // Trigger queue processing if there are items in the queue
    if (this.queue.length > 0 && !this.isProcessing) {
      logger.debug(
        `Triggering queue processing after task completion: ${taskId}`
      );
      this.processQueue();
    }
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
}
