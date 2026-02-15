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

// Register built-in engines
registerRAGEngine(new NaiveRAGEngine());

export { NaiveRAGEngine } from './naive.ts';
export type { EmbeddingProvider, RAGEngine } from './types.ts';
