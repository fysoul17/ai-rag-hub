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
export type { MemoryInterface } from './memory-interface.ts';
export { MemoryClient } from './memory-client.ts';
export { createMemory, type CreateMemoryOptions } from './create-memory.ts';
export { getProvider, LanceDBProvider, registerProvider } from './providers/index.ts';
export type {
  VectorFilter,
  VectorSearchResult,
  VectorStore,
  VectorStoreConfig,
} from './providers/types.ts';
export {
  AgenticRAGEngine,
  getRAGEngine,
  GraphRAGEngine,
  NaiveRAGEngine,
  registerRAGEngine,
} from './rag/index.ts';
export type { EmbeddingProvider, RAGEngine, ReasoningProvider } from './rag/types.ts';
export { type QueryFilters, SQLiteStore } from './sqlite-store.ts';

// Ingestion pipeline
export { chunkText } from './ingestion/chunker.ts';
export { IngestionPipeline } from './ingestion/pipeline.ts';
export type { ChunkingOptions, FileParser, IngestionResult } from './ingestion/types.ts';

// Graph stores
export {
  createGraphStore,
  SQLiteGraphStore,
  Neo4jGraphStore,
  extractEntities,
  createEntityExtractor,
} from './graph/index.ts';
export type {
  GraphStore,
  GraphStoreConfig,
  EntityExtractionResult,
  LLMEntityExtractor,
} from './graph/index.ts';

// Embedding providers
export {
  AnthropicEmbeddingProvider,
  getEmbeddingProvider,
  hashToVector,
  listEmbeddingProviders,
  LocalEmbeddingProvider,
  OpenAIEmbeddingProvider,
  registerEmbeddingProvider,
  StubEmbeddingProvider,
} from './embeddings/index.ts';
export type {
  EmbeddingProviderConfig,
  EmbeddingProviderInstance,
} from './embeddings/index.ts';
