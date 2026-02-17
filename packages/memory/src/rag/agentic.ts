import type { MemoryEntry, MemorySearchParams, MemorySearchResult } from '@autonomy/shared';
import { RAGStrategy } from '@autonomy/shared';
import { MemorySearchError } from '../errors.ts';
import type { VectorStore } from '../providers/types.ts';
import type { SQLiteStore } from '../sqlite-store.ts';
import type { EmbeddingProvider, RAGEngine, ReasoningProvider } from './types.ts';

const DEFAULT_LIMIT = 10;
const MAX_ITERATIONS = 3;
const RELEVANCE_THRESHOLD = 0.3;

/**
 * Agentic RAG: Iterative search with AI-guided query reformulation.
 * Flow: query → initial vector search → evaluate relevance → if low:
 * reformulate query → re-search → max 3 iterations → synthesize
 */
export class AgenticRAGEngine implements RAGEngine {
  readonly strategy = RAGStrategy.AGENTIC;
  private reasoningProvider: ReasoningProvider;

  constructor(reasoningProvider: ReasoningProvider) {
    this.reasoningProvider = reasoningProvider;
  }

  async search(
    params: MemorySearchParams,
    vectorStore: VectorStore,
    sqliteStore: SQLiteStore,
    embed: EmbeddingProvider,
  ): Promise<MemorySearchResult> {
    try {
      const limit = params.limit ?? DEFAULT_LIMIT;
      const collectedEntries = new Map<string, MemoryEntry>();
      let currentQuery = params.query;

      for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        // 1. Embed current query
        const [queryVector] = await embed([currentQuery]);
        if (!queryVector) {
          throw new MemorySearchError('Failed to generate query embedding');
        }

        // 2. Vector search
        const vectorResults = await vectorStore.search(queryVector, limit, {
          type: params.type,
          agentId: params.agentId,
        });

        if (vectorResults.length === 0 && iteration === 0) {
          return { entries: [], totalCount: 0, strategy: this.strategy };
        }

        // 3. Fetch full entries
        const ids = vectorResults.map((r) => r.id);
        const entries = sqliteStore.getEntriesByIds(ids);

        for (const entry of entries) {
          collectedEntries.set(entry.id, entry);
        }

        // 4. Evaluate relevance using AI reasoning
        if (entries.length === 0) break;

        const contentPreview = entries
          .slice(0, 3)
          .map((e) => e.content.slice(0, 200))
          .join('\n---\n');

        const relevancePrompt = `Given the user's original query: "${params.query}"
And the current search query: "${currentQuery}"
Here are the top search results:
${contentPreview}

Rate the relevance of these results on a scale of 0-1 (just respond with the number).
If the results are not relevant enough, suggest a better search query.

Respond in this exact format:
RELEVANCE: <number>
QUERY: <suggested query or "none">`;

        let relevance = 1.0;
        let suggestedQuery: string | null = null;

        try {
          const reasoning = await this.reasoningProvider(relevancePrompt);
          const relevanceMatch = reasoning.match(/RELEVANCE:\s*([\d.]+)/);
          const queryMatch = reasoning.match(/QUERY:\s*(.+)/);

          if (relevanceMatch) {
            relevance = parseFloat(relevanceMatch[1] ?? '1');
          }
          if (queryMatch && queryMatch[1] && queryMatch[1].toLowerCase() !== 'none') {
            suggestedQuery = queryMatch[1].trim();
          }
        } catch {
          // If reasoning fails, accept current results
          break;
        }

        // 5. If relevance is good enough, stop iterating
        if (relevance >= RELEVANCE_THRESHOLD || !suggestedQuery) {
          break;
        }

        // 6. Reformulate query for next iteration
        currentQuery = suggestedQuery;
      }

      // Return collected entries, ordered by insertion (most recently found = most relevant)
      const allEntries = [...collectedEntries.values()].slice(0, limit);

      return {
        entries: allEntries,
        totalCount: allEntries.length,
        strategy: this.strategy,
      };
    } catch (error) {
      if (error instanceof MemorySearchError) throw error;
      throw new MemorySearchError(error instanceof Error ? error.message : String(error));
    }
  }
}
