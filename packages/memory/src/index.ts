// @autonomy/memory — Persistent memory system (bun:sqlite + LanceDB)

export {
  EmbeddingError,
  MemoryError,
  MemoryNotFoundError,
  MemorySearchError,
  MemoryStoreError,
  VectorProviderError,
} from './errors.ts';
export { Memory, type MemoryOptions } from './memory.ts';
export { getProvider, LanceDBProvider, registerProvider } from './providers/index.ts';
export type {
  VectorFilter,
  VectorSearchResult,
  VectorStore,
  VectorStoreConfig,
} from './providers/types.ts';
export { getRAGEngine, NaiveRAGEngine, registerRAGEngine } from './rag/index.ts';
export type { EmbeddingProvider, RAGEngine } from './rag/types.ts';
export { type QueryFilters, SQLiteStore } from './sqlite-store.ts';
