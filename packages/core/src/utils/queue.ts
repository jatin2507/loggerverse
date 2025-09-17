/**
 * High-performance ring buffer implementation for log processing
 * Copyright (c) 2024 Darkninjasolutions. All rights reserved.
 */

import type { LogObject } from '../types/index.js';

/**
 * Single-Producer, Single-Consumer (SPSC) ring buffer for non-blocking log processing
 * Optimized for high-throughput logging with minimal memory allocation
 */
export class NonBlockingQueue {
  private readonly buffer: (LogObject | null)[];
  private readonly capacity: number;
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;

  /**
   * Creates a new NonBlockingQueue instance
   * @param capacity - Maximum number of log objects the queue can hold
   */
  constructor(capacity: number = 10000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  /**
   * Adds a log object to the queue (producer operation)
   * @param logObject - Log object to enqueue
   * @returns True if successfully enqueued, false if queue is full
   */
  public enqueue(logObject: LogObject): boolean {
    if (this.size >= this.capacity) {
      return false; // Queue is full
    }

    this.buffer[this.tail] = logObject;
    this.tail = (this.tail + 1) % this.capacity;
    this.size++;
    return true;
  }

  /**
   * Removes and returns a log object from the queue (consumer operation)
   * @returns Log object if available, null if queue is empty
   */
  public dequeue(): LogObject | null {
    if (this.size === 0) {
      return null; // Queue is empty
    }

    const logObject = this.buffer[this.head];
    this.buffer[this.head] = null; // Clear reference for GC
    this.head = (this.head + 1) % this.capacity;
    this.size--;
    return logObject;
  }

  /**
   * Returns the current number of items in the queue
   * @returns Current queue size
   */
  public getSize(): number {
    return this.size;
  }

  /**
   * Checks if the queue is empty
   * @returns True if queue is empty
   */
  public isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Checks if the queue is full
   * @returns True if queue is full
   */
  public isFull(): boolean {
    return this.size >= this.capacity;
  }

  /**
   * Returns queue utilization as a percentage
   * @returns Utilization percentage (0-100)
   */
  public getUtilization(): number {
    return (this.size / this.capacity) * 100;
  }

  /**
   * Clears all items from the queue
   */
  public clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
}