/**
 * MockVectorStore — test infrastructure for memory package.
 *
 * Implements the VectorStore interface so tests can run without
 * real LanceDB native binaries. Follows the MockBackend pattern
 * from agent-manager.
 */
import { VectorProvider } from '@autonomy/shared';
import type {
  VectorFilter,
  VectorSearchResult,
  VectorStore,
  VectorStoreConfig,
} from '../../src/providers/types.ts';

interface StoredVector {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

export class MockVectorStore implements VectorStore {
  readonly name = VectorProvider.LANCEDB;

  private vectors = new Map<string, StoredVector>();
  private _initialized = false;
  private _config: VectorStoreConfig | null = null;

  /** If set, operations will throw this error. */
  public errorToThrow: Error | null = null;

  /** Track all upsert calls for assertions. */
  public readonly upsertCalls: Array<
    Array<{ id: string; vector: number[]; metadata: Record<string, unknown> }>
  > = [];

  /** Track all search calls for assertions. */
  public readonly searchCalls: Array<{ vector: number[]; limit: number; filter?: VectorFilter }> =
    [];

  get initialized(): boolean {
    return this._initialized;
  }

  get config(): VectorStoreConfig | null {
    return this._config;
  }

  get storedCount(): number {
    return this.vectors.size;
  }

  async initialize(config: VectorStoreConfig): Promise<void> {
    if (this.errorToThrow) throw this.errorToThrow;
    this._config = config;
    this._initialized = true;
  }

  async upsert(
    entries: Array<{ id: string; vector: number[]; metadata: Record<string, unknown> }>,
  ): Promise<void> {
    if (this.errorToThrow) throw this.errorToThrow;
    this.upsertCalls.push(entries);
    for (const entry of entries) {
      this.vectors.set(entry.id, { ...entry });
    }
  }

  async search(
    vector: number[],
    limit: number,
    filter?: VectorFilter,
  ): Promise<VectorSearchResult[]> {
    if (this.errorToThrow) throw this.errorToThrow;
    this.searchCalls.push({ vector, limit, filter });

    let results = [...this.vectors.values()];

    // Apply filters
    if (filter?.type) {
      results = results.filter((v) => v.metadata.type === filter.type);
    }
    if (filter?.agentId) {
      results = results.filter((v) => v.metadata.agentId === filter.agentId);
    }

    // Simple cosine similarity scoring
    const scored = results.map((stored) => ({
      id: stored.id,
      score: cosineSimilarity(vector, stored.vector),
      metadata: stored.metadata,
    }));

    // Sort by score descending, limit
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  async delete(ids: string[]): Promise<void> {
    if (this.errorToThrow) throw this.errorToThrow;
    for (const id of ids) {
      this.vectors.delete(id);
    }
  }

  async count(): Promise<number> {
    if (this.errorToThrow) throw this.errorToThrow;
    return this.vectors.size;
  }

  async shutdown(): Promise<void> {
    this.vectors.clear();
    this._initialized = false;
  }
}

/** Simple cosine similarity for testing. Returns value between -1 and 1. */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}
