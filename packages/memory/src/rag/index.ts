import type { RAGStrategy } from '@autonomy/shared';
import { MemoryError } from '../errors.ts';
import { NaiveRAGEngine } from './naive.ts';
import type { RAGEngine } from './types.ts';

const engines = new Map<string, RAGEngine>();

export function registerRAGEngine(engine: RAGEngine): void {
  engines.set(engine.strategy, engine);
}

export function getRAGEngine(strategy: RAGStrategy): RAGEngine {
  const engine = engines.get(strategy);
  if (!engine) {
    throw new MemoryError(
      `RAG strategy "${strategy}" not registered. Available: ${[...engines.keys()].join(', ')}`,
    );
  }
  return engine;
}

// Register built-in engines (naive is always available)
registerRAGEngine(new NaiveRAGEngine());
// Graph and Agentic engines require constructor injection, so they are registered
// by the consumer (Memory class or memory-server) when the required dependencies are available.

export { NaiveRAGEngine } from './naive.ts';
export { GraphRAGEngine } from './graph.ts';
export { AgenticRAGEngine } from './agentic.ts';
export type { EmbeddingProvider, RAGEngine, ReasoningProvider } from './types.ts';
