import { EventEmitter } from 'events';

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../utils/container', () => ({
  container: {
    getByClass: jest.fn().mockReturnValue({
      scheduledCheck: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('../../telegram/telegram.adapter', () => ({
  removePendingMerchantByMerchantId: jest.fn(),
}));

import { MessageQueueService } from '../message-queue.service';
import { removePendingMerchantByMerchantId } from '../../telegram/telegram.adapter';

describe('MessageQueueService', () => {
  let emitter: EventEmitter;
  let queue: MessageQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    emitter = new EventEmitter();
    // Use a short timeout for tests
    queue = new MessageQueueService(emitter, 1000);
  });

  afterEach(() => {
    jest.useRealTimers();
    emitter.removeAllListeners();
  });

  describe('enqueue', () => {
    it('should add item to queue and start processing', () => {
      // Set up a listener that the queue will emit to
      const handler = jest.fn((_data, callback) => callback());
      emitter.on('queue:testEvent', handler);

      queue.enqueue('testEvent', { key: 'value' });
      expect(queue.getQueueLength()).toBe(1);
    });

    it('should deduplicate by taskId', () => {
      const handler = jest.fn((_data, callback) => callback());
      emitter.on('queue:testEvent', handler);

      queue.enqueue('testEvent', { key: 1 }, 'task-1');
      queue.enqueue('testEvent', { key: 2 }, 'task-1');
      expect(queue.getQueueLength()).toBe(1);
    });

    it('should allow different taskIds', () => {
      const handler = jest.fn((_data, callback) => callback());
      emitter.on('queue:testEvent', handler);

      queue.enqueue('testEvent', { key: 1 }, 'task-1');
      queue.enqueue('testEvent', { key: 2 }, 'task-2');
      expect(queue.getQueueLength()).toBe(2);
    });
  });

  describe('completeTask', () => {
    it('should remove task from queue', () => {
      // Don't set up handler so queue stays in processing state
      queue.enqueue('testEvent', { key: 1 }, 'task-1');
      queue.enqueue('testEvent', { key: 2 }, 'task-2');

      queue.completeTask('task-1');
      expect(queue.getQueueLength()).toBe(1);
    });

    it('should ignore completion for non-existent task', () => {
      // Should not throw
      queue.completeTask('non-existent');
      expect(queue.getQueueLength()).toBe(0);
    });
  });

  describe('task timeout', () => {
    it('should auto-complete task after timeout', () => {
      queue.enqueue('testEvent', { merchant: 'GRAB' }, 'task-1');

      // Fast-forward past timeout
      jest.advanceTimersByTime(1100);

      // removePendingMerchantByMerchantId should have been called
      expect(removePendingMerchantByMerchantId).toHaveBeenCalledWith('task-1');
    });
  });

  describe('clearTasksByMerchant', () => {
    it('should remove tasks matching merchant name', () => {
      queue.enqueue('e', { merchant: 'GRAB' }, 'task-1');
      queue.enqueue('e', { merchant: 'AMAZON' }, 'task-2');
      queue.enqueue('e', { merchant: 'GRAB' }, 'task-3');

      queue.clearTasksByMerchant('GRAB');

      // Only AMAZON should remain (task-2), plus whatever is processing
      // The first item is being processed, second got cleared
      expect(queue.getQueueLength()).toBe(1);
    });

    it('should not remove tasks without merchant data', () => {
      queue.enqueue('e', { other: 'data' }, 'task-1');
      queue.clearTasksByMerchant('GRAB');
      expect(queue.getQueueLength()).toBe(1);
    });
  });

  describe('state accessors', () => {
    it('getQueueLength should return 0 for empty queue', () => {
      expect(queue.getQueueLength()).toBe(0);
    });

    it('isQueueProcessing should return false initially', () => {
      expect(queue.isQueueProcessing()).toBe(false);
    });

    it('isQueueProcessing should return true while processing', () => {
      queue.enqueue('testEvent', {});
      expect(queue.isQueueProcessing()).toBe(true);
    });
  });
});
