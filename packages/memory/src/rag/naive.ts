import type { MemorySearchParams, MemorySearchResult } from '@autonomy/shared';
import { RAGStrategy } from '@autonomy/shared';
import { MemorySearchError } from '../errors.ts';
import type { VectorStore } from '../providers/types.ts';
import type { SQLiteStore } from '../sqlite-store.ts';
import type { EmbeddingProvider, RAGEngine } from './types.ts';

const DEFAULT_LIMIT = 10;

export class NaiveRAGEngine implements RAGEngine {
  readonly strategy = RAGStrategy.NAIVE;

  async search(
    params: MemorySearchParams,
    vectorStore: VectorStore,
    sqliteStore: SQLiteStore,
    embed: EmbeddingProvider,
  ): Promise<MemorySearchResult> {
    try {
      const limit = params.limit ?? DEFAULT_LIMIT;

      // 1. Embed the query
      const [queryVector] = await embed([params.query]);
      if (!queryVector) {
        throw new MemorySearchError('Failed to generate query embedding');
      }

      // 2. Vector search for top-K nearest
      const vectorResults = await vectorStore.search(queryVector, limit, {
        type: params.type,
        agentId: params.agentId,
      });

      if (vectorResults.length === 0) {
        return { entries: [], totalCount: 0, strategy: this.strategy };
      }

      // 3. Fetch full entries from SQLite by ID
      const ids = vectorResults.map((r) => r.id);
      const entries = sqliteStore.getEntriesByIds(ids);

      // 4. Preserve vector search ordering (by relevance score)
      const entryMap = new Map(entries.map((e) => [e.id, e]));
      const orderedEntries = ids
        .map((id) => entryMap.get(id))
        .filter((e): e is NonNullable<typeof e> => e != null);

      return {
        entries: orderedEntries,
        totalCount: orderedEntries.length,
        strategy: this.strategy,
      };
    } catch (error) {
      if (error instanceof MemorySearchError) throw error;
      throw new MemorySearchError(error instanceof Error ? error.message : String(error));
    }
  }
}
