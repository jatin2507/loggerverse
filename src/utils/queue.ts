import type { LogObject } from '../types/index.js';

export class NonBlockingQueue {
  private buffer: LogObject[];
  private capacity: number;
  private head: number;
  private tail: number;
  private size: number;

  constructor(capacity = 10000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  push(item: LogObject): boolean {
    if (this.size >= this.capacity) {
      return false; // Queue is full, drop the log
    }

    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    this.size++;
    return true;
  }

  pop(): LogObject | null {
    if (this.size === 0) {
      return null;
    }

    const item = this.buffer[this.head];
    this.head = (this.head + 1) % this.capacity;
    this.size--;
    return item;
  }

  isEmpty(): boolean {
    return this.size === 0;
  }

  isFull(): boolean {
    return this.size >= this.capacity;
  }

  getSize(): number {
    return this.size;
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
}