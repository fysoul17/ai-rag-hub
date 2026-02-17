import type {
  ApiResponse,
  MemoryEntry,
  MemorySearchParams,
  MemorySearchResult,
  MemoryStats,
} from '@autonomy/shared';
import type { MemoryInterface } from './memory-interface.ts';

export class MemoryClient implements MemoryInterface {
  private baseUrl: string;

  constructor(memoryUrl: string) {
    // Strip trailing slash
    this.baseUrl = memoryUrl.replace(/\/$/, '');
  }

  /** Encode a path segment to prevent URL injection */
  private encodePathSegment(segment: string): string {
    return encodeURIComponent(segment);
  }

  async initialize(): Promise<void> {
    // Verify connectivity with health check
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Memory server not reachable at ${this.baseUrl}: ${response.status}`);
    }
  }

  async store(
    entry: Omit<MemoryEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  ): Promise<MemoryEntry> {
    return this.fetchApi<MemoryEntry>('/api/memory/ingest', {
      method: 'POST',
      body: JSON.stringify({
        content: entry.content,
        type: entry.type,
        metadata: entry.metadata,
      }),
    });
  }

  async search(params: MemorySearchParams): Promise<MemorySearchResult> {
    const searchParams = new URLSearchParams({ query: params.query });
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.type) searchParams.set('type', params.type);
    if (params.agentId) searchParams.set('agentId', params.agentId);
    if (params.strategy) searchParams.set('strategy', params.strategy);
    return this.fetchApi<MemorySearchResult>(`/api/memory/search?${searchParams}`);
  }

  async get(id: string): Promise<MemoryEntry | null> {
    try {
      return await this.fetchApi<MemoryEntry>(`/api/memory/entries/${this.encodePathSegment(id)}`);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.fetchApi(`/api/memory/entries/${this.encodePathSegment(id)}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async clearSession(sessionId: string): Promise<number> {
    const result = await this.fetchApi<{ cleared: number }>(
      `/api/memory/sessions/${this.encodePathSegment(sessionId)}`,
      { method: 'DELETE' },
    );
    return result.cleared;
  }

  async stats(): Promise<MemoryStats> {
    return this.fetchApi<MemoryStats>('/api/memory/stats');
  }

  async shutdown(): Promise<void> {
    // No-op for remote client
  }

  private async fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const body = (await res.json()) as ApiResponse<T>;
    if (!body.success || body.data === undefined) {
      throw new Error(body.error ?? `Memory server error: ${res.status}`);
    }
    return body.data;
  }
}
