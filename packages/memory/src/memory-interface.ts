import type {
  MemoryEntry,
  MemorySearchParams,
  MemorySearchResult,
  MemoryStats,
} from '@autonomy/shared';

/** Abstract interface for memory systems (local or remote). */
export interface MemoryInterface {
  initialize(): Promise<void>;
  store(
    entry: Omit<MemoryEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  ): Promise<MemoryEntry>;
  search(params: MemorySearchParams): Promise<MemorySearchResult>;
  get(id: string): Promise<MemoryEntry | null>;
  delete(id: string): Promise<boolean>;
  clearSession(sessionId: string): Promise<number>;
  stats(): Promise<MemoryStats>;
  shutdown(): Promise<void>;
}
