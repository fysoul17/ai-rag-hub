export { SQLiteGraphStore } from './sqlite-graph.ts';
export { Neo4jGraphStore } from './neo4j.ts';
export { extractEntities, createEntityExtractor } from './entity-extractor.ts';
export type { GraphStore, GraphStoreConfig, EntityExtractionResult } from './types.ts';
export type { LLMEntityExtractor } from './entity-extractor.ts';

import type { GraphStore, GraphStoreConfig } from './types.ts';
import { Neo4jGraphStore } from './neo4j.ts';
import { SQLiteGraphStore } from './sqlite-graph.ts';

export function createGraphStore(config: GraphStoreConfig): GraphStore {
  if (config.neo4jUrl) {
    return new Neo4jGraphStore();
  }
  return new SQLiteGraphStore();
}
