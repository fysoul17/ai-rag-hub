import type { MemorySearchParams, MemorySearchResult, RAGStrategy } from '@autonomy/shared';
import type { SQLiteStore } from '../sqlite-store.ts';
import type { VectorStore } from '../providers/types.ts';

/** Function that generates vector embeddings from text. */
export type EmbeddingProvider = (texts: string[]) => Promise<number[][]>;

/** Pluggable RAG strategy for memory search. */
export interface RAGEngine {
  /** Strategy identifier (e.g., 'naive', 'graph', 'agentic'). */
  readonly strategy: RAGStrategy;
  /** Execute a search using this RAG strategy. */
  search(
    params: MemorySearchParams,
    vectorStore: VectorStore,
    sqliteStore: SQLiteStore,
    embed: EmbeddingProvider,
  ): Promise<MemorySearchResult>;
}
