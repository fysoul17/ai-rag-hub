// @autonomy/memory — Persistent memory system (bun:sqlite + LanceDB)

export { type CreateMemoryOptions, createMemory } from './create-memory.ts';
export type {
  EmbeddingProviderConfig,
  EmbeddingProviderInstance,
} from './embeddings/index.ts';
// Embedding providers
export {
  AnthropicEmbeddingProvider,
  getEmbeddingProvider,
  hashToVector,
  LocalEmbeddingProvider,
  listEmbeddingProviders,
  OpenAIEmbeddingProvider,
  registerEmbeddingProvider,
  StubEmbeddingProvider,
} from './embeddings/index.ts';
export {
  EmbeddingError,
  MemoryError,
  MemoryNotFoundError,
  MemorySearchError,
  MemoryStoreError,
  VectorProviderError,
} from './errors.ts';
export type {
  EntityExtractionResult,
  GraphStore,
  GraphStoreConfig,
  LLMEntityExtractor,
} from './graph/index.ts';
// Graph stores
export {
  createEntityExtractor,
  createGraphStore,
  extractEntities,
  Neo4jGraphStore,
  SQLiteGraphStore,
} from './graph/index.ts';
// Ingestion pipeline
export { chunkText } from './ingestion/chunker.ts';
export { getSupportedExtensions } from './ingestion/parsers/index.ts';
export { IngestionPipeline } from './ingestion/pipeline.ts';
export type { ChunkingOptions, FileParser, IngestionResult } from './ingestion/types.ts';
export { Memory, type MemoryOptions } from './memory.ts';
export { MemoryClient } from './memory-client.ts';
export type { MemoryInterface } from './memory-interface.ts';
export { getProvider, LanceDBProvider, registerProvider } from './providers/index.ts';
export type {
  VectorFilter,
  VectorSearchResult,
  VectorStore,
  VectorStoreConfig,
} from './providers/types.ts';
export {
  AgenticRAGEngine,
  GraphRAGEngine,
  getRAGEngine,
  NaiveRAGEngine,
  registerRAGEngine,
} from './rag/index.ts';
export type { EmbeddingProvider, RAGEngine, ReasoningProvider } from './rag/types.ts';
export { type QueryFilters, SQLiteStore } from './sqlite-store.ts';
