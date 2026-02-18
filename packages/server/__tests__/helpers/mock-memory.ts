import type { MemoryInterface } from '@autonomy/memory';
import type { MemoryEntry, MemorySearchParams, MemorySearchResult, MemoryStats } from '@autonomy/shared';

export class MockMemory implements MemoryInterface {
  clearSessionCalls: string[] = [];
  initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async store(
    entry: Omit<MemoryEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  ): Promise<MemoryEntry> {
    return {
      id: entry.id ?? crypto.randomUUID(),
      content: entry.content,
      sessionId: entry.sessionId,
      agentId: entry.agentId,
      tags: entry.tags ?? [],
      createdAt: entry.createdAt ?? new Date().toISOString(),
    };
  }

  async search(_params: MemorySearchParams): Promise<MemorySearchResult> {
    return { entries: [], total: 0 };
  }

  async get(_id: string): Promise<MemoryEntry | null> {
    return null;
  }

  async delete(_id: string): Promise<boolean> {
    return false;
  }

  async clearSession(sessionId: string): Promise<number> {
    this.clearSessionCalls.push(sessionId);
    return 0;
  }

  async stats(): Promise<MemoryStats> {
    return { totalEntries: 0, totalSessions: 0, totalAgents: 0 };
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }
}
