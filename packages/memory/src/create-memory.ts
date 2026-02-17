import type { MemoryInterface } from './memory-interface.ts';
import { Memory, type MemoryOptions } from './memory.ts';
import { MemoryClient } from './memory-client.ts';

export interface CreateMemoryOptions extends MemoryOptions {
  memoryUrl?: string;
}

export function createMemory(options: CreateMemoryOptions): MemoryInterface {
  if (options.memoryUrl) {
    return new MemoryClient(options.memoryUrl);
  }
  return new Memory(options);
}
