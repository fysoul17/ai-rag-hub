import type { MemorySearchParams, MemorySearchResult } from '@autonomy/shared';
import { RAGStrategy } from '@autonomy/shared';
import { MemorySearchError } from '../errors.ts';
import type { GraphStore } from '../graph/types.ts';
import type { VectorStore } from '../providers/types.ts';
import type { SQLiteStore } from '../sqlite-store.ts';
import type { EmbeddingProvider, RAGEngine } from './types.ts';

const DEFAULT_LIMIT = 10;
const DEFAULT_GRAPH_DEPTH = 2;

/** Extract potential entity names from a query via simple heuristics. */
function extractQueryEntities(query: string): string[] {
  const entities: string[] = [];

  // Capitalized words (likely proper nouns / entity names)
  const capitalizedPattern = /\b[A-Z][a-z]{2,}\b/g;
  let match = capitalizedPattern.exec(query);
  while (match) {
    entities.push(match[0]);
    match = capitalizedPattern.exec(query);
  }

  // Multi-word capitalized phrases
  const phrasePattern = /\b(?:[A-Z][a-z]+\s+){1,3}[A-Z][a-z]+\b/g;
  match = phrasePattern.exec(query);
  while (match) {
    entities.push(match[0]);
    match = phrasePattern.exec(query);
  }

  // If no capitalized entities, use significant words (4+ chars, not stop words)
  if (entities.length === 0) {
    const stopWords = new Set([
      'what', 'when', 'where', 'which', 'that', 'this', 'with', 'from',
      'have', 'been', 'will', 'would', 'could', 'should', 'about', 'their',
      'there', 'these', 'those', 'does', 'know', 'find', 'show', 'tell',
    ]);
    const words = query.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length >= 4 && !stopWords.has(word)) {
        entities.push(word);
      }
    }
  }

  return [...new Set(entities)];
}

/**
 * Graph RAG: Combines vector search with knowledge graph traversal.
 * Flow: query → extract entities → find graph nodes → traverse → collect memory IDs
 * → fetch from SQLite → hybrid rank (graph + vector) → return
 */
export class GraphRAGEngine implements RAGEngine {
  readonly strategy = RAGStrategy.GRAPH;
  private graphStore: GraphStore;

  constructor(graphStore: GraphStore) {
    this.graphStore = graphStore;
  }

  async search(
    params: MemorySearchParams,
    vectorStore: VectorStore,
    sqliteStore: SQLiteStore,
    embed: EmbeddingProvider,
  ): Promise<MemorySearchResult> {
    try {
      const limit = params.limit ?? DEFAULT_LIMIT;

      // 1. Standard vector search (same as naive)
      const [queryVector] = await embed([params.query]);
      if (!queryVector) {
        throw new MemorySearchError('Failed to generate query embedding');
      }

      const vectorResults = await vectorStore.search(queryVector, limit, {
        type: params.type,
        agentId: params.agentId,
      });

      const vectorIds = new Set(vectorResults.map((r) => r.id));
      const vectorScores = new Map(vectorResults.map((r) => [r.id, r.score]));

      // 2. Extract entities from query and find graph nodes
      const queryEntities = extractQueryEntities(params.query);
      const graphMemoryIds = new Set<string>();
      const graphScores = new Map<string, number>();

      for (const entity of queryEntities) {
        const nodes = await this.graphStore.findNodes({ name: entity, limit: 5 });
        for (const node of nodes) {
          // Collect memory entry IDs directly from nodes
          for (const memId of node.memoryEntryIds) {
            graphMemoryIds.add(memId);
            graphScores.set(memId, Math.max(graphScores.get(memId) ?? 0, 0.8));
          }

          // Traverse graph neighbors
          const traversal = await this.graphStore.getNeighbors(node.id, DEFAULT_GRAPH_DEPTH);
          for (const neighbor of traversal.nodes) {
            for (const memId of neighbor.memoryEntryIds) {
              graphMemoryIds.add(memId);
              // Neighbors get lower score than direct matches
              graphScores.set(memId, Math.max(graphScores.get(memId) ?? 0, 0.5));
            }
          }
        }
      }

      // 3. Combine IDs from both sources
      const allIds = [...new Set([...vectorIds, ...graphMemoryIds])];

      if (allIds.length === 0) {
        return { entries: [], totalCount: 0, strategy: this.strategy };
      }

      // 4. Fetch full entries from SQLite
      const entries = sqliteStore.getEntriesByIds(allIds);
      const entryMap = new Map(entries.map((e) => [e.id, e]));

      // 5. Hybrid ranking: combine vector score + graph score
      const scored = allIds
        .map((id) => {
          const entry = entryMap.get(id);
          if (!entry) return null;
          const vScore = vectorScores.get(id) ?? 0;
          const gScore = graphScores.get(id) ?? 0;
          // Weighted combination: 60% vector, 40% graph
          const hybridScore = vScore * 0.6 + gScore * 0.4;
          return { entry, score: hybridScore };
        })
        .filter((s): s is NonNullable<typeof s> => s != null)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return {
        entries: scored.map((s) => s.entry),
        totalCount: scored.length,
        strategy: this.strategy,
      };
    } catch (error) {
      if (error instanceof MemorySearchError) throw error;
      throw new MemorySearchError(error instanceof Error ? error.message : String(error));
    }
  }
}
