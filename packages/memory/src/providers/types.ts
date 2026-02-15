import type { VectorProvider } from '@autonomy/shared';

/** A single vector search result with score. */
export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

/** Filter criteria for vector search. */
export interface VectorFilter {
  type?: string;
  agentId?: string;
}

/** Configuration for initializing a VectorStore. */
export interface VectorStoreConfig {
  /** Directory where the vector data is stored on disk. */
  dataDir: string;
  /** Dimension of the embedding vectors. */
  dimensions: number;
}

/** Pluggable vector storage backend for semantic search. */
export interface VectorStore {
  /** Provider identifier (e.g., 'lancedb', 'qdrant'). */
  readonly name: VectorProvider;
  /** Initialize the vector store (create tables, connect). */
  initialize(config: VectorStoreConfig): Promise<void>;
  /** Add or update vectors with associated metadata. */
  upsert(
    entries: Array<{
      id: string;
      vector: number[];
      metadata: Record<string, unknown>;
    }>,
  ): Promise<void>;
  /** Search for the top-K nearest vectors. */
  search(vector: number[], limit: number, filter?: VectorFilter): Promise<VectorSearchResult[]>;
  /** Delete vectors by IDs. */
  delete(ids: string[]): Promise<void>;
  /** Count total vectors stored. */
  count(): Promise<number>;
  /** Shut down the connection. Idempotent. */
  shutdown(): Promise<void>;
}
