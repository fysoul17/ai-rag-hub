// @autonomy/memory — Persistent memory system (bun:sqlite + LanceDB)

export { Memory, type MemoryOptions } from './memory.ts';
export { SQLiteStore, type QueryFilters } from './sqlite-store.ts';
export { LanceDBProvider, getProvider, registerProvider } from './providers/index.ts';
export type { VectorFilter, VectorSearchResult, VectorStore, VectorStoreConfig } from './providers/types.ts';
export { NaiveRAGEngine, getRAGEngine, registerRAGEngine } from './rag/index.ts';
export type { EmbeddingProvider, RAGEngine } from './rag/types.ts';
export {
  EmbeddingError,
  MemoryError,
  MemoryNotFoundError,
  MemorySearchError,
  MemoryStoreError,
  VectorProviderError,
} from './errors.ts';
