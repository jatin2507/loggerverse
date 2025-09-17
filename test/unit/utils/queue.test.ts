import { describe, it, expect, beforeEach } from 'vitest';
import { NonBlockingQueue } from '../../../src/utils/queue.js';
import type { LogObject } from '../../../src/types/index.js';

describe('NonBlockingQueue', () => {
  let queue: NonBlockingQueue;
  let sampleLog: LogObject;

  beforeEach(() => {
    queue = new NonBlockingQueue(3); // Small capacity for testing
    sampleLog = {
      timestamp: Date.now(),
      level: 'info',
      hostname: 'test-host',
      pid: 1234,
      message: 'test message',
    };
  });

  describe('initialization', () => {
    it('should create queue with default capacity', () => {
      const defaultQueue = new NonBlockingQueue();
      expect(defaultQueue).toBeInstanceOf(NonBlockingQueue);
      expect(defaultQueue.isEmpty()).toBe(true);
      expect(defaultQueue.getSize()).toBe(0);
    });

    it('should create queue with custom capacity', () => {
      expect(queue).toBeInstanceOf(NonBlockingQueue);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.getSize()).toBe(0);
    });
  });

  describe('push operations', () => {
    it('should push items to queue', () => {
      const result = queue.push(sampleLog);
      expect(result).toBe(true);
      expect(queue.isEmpty()).toBe(false);
      expect(queue.getSize()).toBe(1);
    });

    it('should handle multiple pushes', () => {
      queue.push({ ...sampleLog, message: 'message 1' });
      queue.push({ ...sampleLog, message: 'message 2' });
      queue.push({ ...sampleLog, message: 'message 3' });

      expect(queue.getSize()).toBe(3);
      expect(queue.isFull()).toBe(true);
    });

    it('should reject push when queue is full', () => {
      // Fill the queue
      queue.push({ ...sampleLog, message: 'message 1' });
      queue.push({ ...sampleLog, message: 'message 2' });
      queue.push({ ...sampleLog, message: 'message 3' });

      // Try to add one more
      const result = queue.push({ ...sampleLog, message: 'message 4' });
      expect(result).toBe(false);
      expect(queue.getSize()).toBe(3);
    });
  });

  describe('pop operations', () => {
    it('should return null when queue is empty', () => {
      const result = queue.pop();
      expect(result).toBeNull();
    });

    it('should pop items in FIFO order', () => {
      const log1 = { ...sampleLog, message: 'message 1' };
      const log2 = { ...sampleLog, message: 'message 2' };
      const log3 = { ...sampleLog, message: 'message 3' };

      queue.push(log1);
      queue.push(log2);
      queue.push(log3);

      expect(queue.pop()).toEqual(log1);
      expect(queue.pop()).toEqual(log2);
      expect(queue.pop()).toEqual(log3);
      expect(queue.pop()).toBeNull();
    });

    it('should update size correctly after popping', () => {
      queue.push(sampleLog);
      queue.push(sampleLog);
      expect(queue.getSize()).toBe(2);

      queue.pop();
      expect(queue.getSize()).toBe(1);

      queue.pop();
      expect(queue.getSize()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('state checking methods', () => {
    it('should correctly report empty state', () => {
      expect(queue.isEmpty()).toBe(true);
      queue.push(sampleLog);
      expect(queue.isEmpty()).toBe(false);
      queue.pop();
      expect(queue.isEmpty()).toBe(true);
    });

    it('should correctly report full state', () => {
      expect(queue.isFull()).toBe(false);

      queue.push(sampleLog);
      queue.push(sampleLog);
      expect(queue.isFull()).toBe(false);

      queue.push(sampleLog);
      expect(queue.isFull()).toBe(true);
    });

    it('should correctly report size', () => {
      expect(queue.getSize()).toBe(0);

      queue.push(sampleLog);
      expect(queue.getSize()).toBe(1);

      queue.push(sampleLog);
      expect(queue.getSize()).toBe(2);

      queue.pop();
      expect(queue.getSize()).toBe(1);
    });
  });

  describe('clear operation', () => {
    it('should clear all items from queue', () => {
      queue.push(sampleLog);
      queue.push(sampleLog);
      queue.push(sampleLog);

      expect(queue.getSize()).toBe(3);

      queue.clear();

      expect(queue.getSize()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.isFull()).toBe(false);
    });
  });

  describe('circular buffer behavior', () => {
    it('should handle wraparound correctly', () => {
      // Fill and empty the queue multiple times
      for (let i = 0; i < 10; i++) {
        queue.push({ ...sampleLog, message: `message ${i}` });

        if (queue.isFull()) {
          // Empty the queue
          while (!queue.isEmpty()) {
            queue.pop();
          }
        }
      }

      // Empty any remaining items from the loop
      while (!queue.isEmpty()) {
        queue.pop();
      }

      // Should still work normally
      queue.push({ ...sampleLog, message: 'final message' });
      const result = queue.pop();
      expect(result?.message).toBe('final message');
    });

    it('should handle mixed push/pop operations', () => {
      queue.push({ ...sampleLog, message: 'A' });
      queue.push({ ...sampleLog, message: 'B' });

      expect(queue.pop()?.message).toBe('A');

      queue.push({ ...sampleLog, message: 'C' });
      queue.push({ ...sampleLog, message: 'D' });

      expect(queue.pop()?.message).toBe('B');
      expect(queue.pop()?.message).toBe('C');
      expect(queue.pop()?.message).toBe('D');
    });
  });
});