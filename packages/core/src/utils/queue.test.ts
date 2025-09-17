/**
 * Tests for NonBlockingQueue utility
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NonBlockingQueue } from './queue.js';
import type { LogObject } from '../types/index.js';

// Helper function to create test log objects
const createLogObject = (meta?: Record<string, unknown>): LogObject => ({
  timestamp: Date.now(),
  level: 'info',
  hostname: 'test-host',
  pid: 1234,
  message: 'Test message',
  meta
});

describe('NonBlockingQueue', () => {
  let queue: NonBlockingQueue;

  beforeEach(() => {
    queue = new NonBlockingQueue();
  });

  describe('Basic Operations', () => {
    it('should enqueue and dequeue items', () => {
      const item = {
        timestamp: Date.now(),
        level: 'info' as const,
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message',
        meta: { test: 'data' }
      };

      const enqueued = queue.enqueue(item);
      expect(enqueued).toBe(true);

      const dequeued = queue.dequeue();
      expect(dequeued).toEqual(item);
    });

    it('should return null when dequeuing from empty queue', () => {
      const result = queue.dequeue();
      expect(result).toBeNull();
    });

    it('should maintain FIFO order', () => {
      const baseItem = {
        timestamp: Date.now(),
        level: 'info' as const,
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message'
      };

      const items = [
        { ...baseItem, meta: { id: 1, data: 'first' } },
        { ...baseItem, meta: { id: 2, data: 'second' } },
        { ...baseItem, meta: { id: 3, data: 'third' } }
      ];

      items.forEach(item => queue.enqueue(item));

      const results = [];
      let item;
      while ((item = queue.dequeue()) !== null) {
        results.push(item);
      }

      expect(results).toEqual(items);
    });
  });

  describe('Size Management', () => {
    it('should track queue size correctly', () => {
      expect(queue.getSize()).toBe(0);

      queue.enqueue(createLogObject({ test: 1 }));
      expect(queue.getSize()).toBe(1);

      queue.enqueue(createLogObject({ test: 2 }));
      expect(queue.getSize()).toBe(2);

      queue.dequeue();
      expect(queue.getSize()).toBe(1);

      queue.dequeue();
      expect(queue.getSize()).toBe(0);
    });

    it('should report empty status correctly', () => {
      expect(queue.isEmpty()).toBe(true);

      queue.enqueue(createLogObject({ test: 'data' }));
      expect(queue.isEmpty()).toBe(false);

      queue.dequeue();
      expect(queue.isEmpty()).toBe(true);
    });

    it('should report full status correctly with default capacity', () => {
      // Fill queue to default capacity (assuming 10000)
      const capacity = 10000;

      for (let i = 0; i < capacity; i++) {
        const enqueued = queue.enqueue(createLogObject({ id: i }));
        expect(enqueued).toBe(true);
      }

      expect(queue.isFull()).toBe(true);

      // Should reject additional items
      const rejected = queue.enqueue(createLogObject({ overflow: true }));
      expect(rejected).toBe(false);
    });
  });

  describe('Custom Capacity', () => {
    it('should respect custom capacity', () => {
      const customQueue = new NonBlockingQueue(3);

      // Fill to capacity
      expect(customQueue.enqueue({ id: 1 })).toBe(true);
      expect(customQueue.enqueue({ id: 2 })).toBe(true);
      expect(customQueue.enqueue({ id: 3 })).toBe(true);

      expect(customQueue.isFull()).toBe(true);
      expect(customQueue.getSize()).toBe(3);

      // Should reject additional items
      expect(customQueue.enqueue({ id: 4 })).toBe(false);
      expect(customQueue.getSize()).toBe(3);
    });

    it('should handle capacity of 1', () => {
      const singleQueue = new NonBlockingQueue(1);

      expect(singleQueue.enqueue({ data: 'first' })).toBe(true);
      expect(singleQueue.isFull()).toBe(true);

      expect(singleQueue.enqueue({ data: 'second' })).toBe(false);

      const item = singleQueue.dequeue();
      expect(item).toEqual({ data: 'first' });
      expect(singleQueue.isEmpty()).toBe(true);
    });
  });

  describe('Clear Operation', () => {
    it('should clear all items from queue', () => {
      queue.enqueue(createLogObject({ test: 1 }));
      queue.enqueue(createLogObject({ test: 2 }));
      queue.enqueue(createLogObject({ test: 3 }));

      expect(queue.getSize()).toBe(3);

      queue.clear();

      expect(queue.getSize()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.dequeue()).toBeNull();
    });

    it('should clear empty queue without errors', () => {
      expect(() => queue.clear()).not.toThrow();
      expect(queue.getSize()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle rapid enqueue/dequeue operations', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i, data: `item-${i}` }));

      // Rapid enqueue
      items.forEach(item => {
        const enqueued = queue.enqueue(item);
        expect(enqueued).toBe(true);
      });

      expect(queue.getSize()).toBe(1000);

      // Rapid dequeue
      const results = [];
      let item;
      while ((item = queue.dequeue()) !== null) {
        results.push(item);
      }

      expect(results).toEqual(items);
      expect(queue.isEmpty()).toBe(true);
    });

    it('should handle interleaved enqueue/dequeue operations', () => {
      const results = [];

      // Interleaved operations
      const log1 = createLogObject({ id: 1 });
      const log2 = createLogObject({ id: 2 });
      const log3 = createLogObject({ id: 3 });

      queue.enqueue(log1);
      queue.enqueue(log2);

      results.push(queue.dequeue());

      queue.enqueue(log3);

      results.push(queue.dequeue());
      results.push(queue.dequeue());

      expect(results).toEqual([
        log1,
        log2,
        log3
      ]);
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('Data Types', () => {
    it('should handle different data types in meta field', () => {
      const baseLogObject = {
        timestamp: Date.now(),
        level: 'info' as const,
        hostname: 'test-host',
        pid: 1234,
        message: 'Test message'
      };

      const items = [
        { ...baseLogObject, meta: { data: 'string' } },
        { ...baseLogObject, meta: { data: 123 } },
        { ...baseLogObject, meta: { data: true } },
        { ...baseLogObject, meta: { data: null } },
        { ...baseLogObject, meta: { data: undefined } },
        { ...baseLogObject, meta: { object: 'value' } },
        { ...baseLogObject, meta: { array: [1, 2, 3] } },
        { ...baseLogObject, meta: { date: new Date() } },
        { ...baseLogObject, meta: { regex: /regex/g.toString() } }
      ];

      items.forEach(item => queue.enqueue(item));

      const results = [];
      let item;
      while ((item = queue.dequeue()) !== null) {
        results.push(item);
      }

      expect(results).toEqual(items);
    });

    it('should handle complex nested objects', () => {
      const complexItem = {
        user: {
          id: 123,
          profile: {
            name: 'John Doe',
            settings: {
              theme: 'dark',
              notifications: true
            }
          }
        },
        metadata: {
          timestamp: new Date(),
          tags: ['tag1', 'tag2'],
          counts: { views: 10, likes: 5 }
        }
      };

      queue.enqueue(complexItem);
      const result = queue.dequeue();

      expect(result).toEqual(complexItem);
    });
  });

  describe('Error Handling', () => {
    it('should handle queue operations under stress', () => {
      const smallQueue = new NonBlockingQueue(10);
      let successfulEnqueues = 0;
      let rejectedEnqueues = 0;

      // Try to enqueue more items than capacity
      for (let i = 0; i < 20; i++) {
        const result = smallQueue.enqueue({ id: i });
        if (result) {
          successfulEnqueues++;
        } else {
          rejectedEnqueues++;
        }
      }

      expect(successfulEnqueues).toBe(10);
      expect(rejectedEnqueues).toBe(10);
      expect(smallQueue.isFull()).toBe(true);
    });

    it('should maintain consistency during concurrent-like operations', () => {
      // Simulate concurrent-like operations
      const operations = [];

      // Mix of enqueue and dequeue operations
      for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
          // Dequeue operation
          operations.push(() => queue.dequeue());
        } else {
          // Enqueue operation
          operations.push(() => queue.enqueue(createLogObject({ id: i })));
        }
      }

      // Execute operations
      expect(() => {
        operations.forEach(op => op());
      }).not.toThrow();

      // Queue should be in valid state
      expect(queue.getSize()).toBeGreaterThanOrEqual(0);
      expect(queue.getSize()).toBeLessThanOrEqual(operations.length);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory when repeatedly filled and cleared', () => {
      // This test checks for obvious memory leaks
      const initialSize = queue.getSize();

      for (let cycle = 0; cycle < 10; cycle++) {
        // Fill queue
        for (let i = 0; i < 100; i++) {
          queue.enqueue(createLogObject({ cycle, item: i, data: new Array(100).fill('x') }));
        }

        // Empty queue
        while (!queue.isEmpty()) {
          queue.dequeue();
        }

        expect(queue.getSize()).toBe(initialSize);
        expect(queue.isEmpty()).toBe(true);
      }
    });

    it('should handle clear operation efficiently', () => {
      // Fill with many items
      for (let i = 0; i < 1000; i++) {
        queue.enqueue(createLogObject({ id: i, data: `item-${i}` }));
      }

      const startTime = Date.now();
      queue.clear();
      const endTime = Date.now();

      expect(queue.isEmpty()).toBe(true);
      expect(queue.getSize()).toBe(0);
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
    });
  });
});