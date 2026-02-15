import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { MemoryType, RAGStrategy } from '@autonomy/shared';
import { NaiveRAGEngine } from '../src/rag/naive.ts';
import type { EmbeddingProvider } from '../src/rag/types.ts';
import { SQLiteStore } from '../src/sqlite-store.ts';
import { makeMemoryEntry } from './helpers/fixtures.ts';
import { createMockEmbedder } from './helpers/mock-embedder.ts';
import { MockVectorStore } from './helpers/mock-vector-store.ts';

describe('NaiveRAGEngine', () => {
  let store: SQLiteStore;
  let vectorStore: MockVectorStore;
  let embedder: EmbeddingProvider;
  let rag: NaiveRAGEngine;

  beforeEach(async () => {
    store = new SQLiteStore(':memory:');
    vectorStore = new MockVectorStore();
    await vectorStore.initialize({ dataDir: '/tmp/test', dimensions: 8 });
    embedder = createMockEmbedder(8);
    rag = new NaiveRAGEngine();
  });

  afterEach(async () => {
    store.close();
    await vectorStore.shutdown();
  });

  /** Helper to store an entry in both SQLite and vector store. */
  async function storeWithEmbedding(
    overrides: Partial<Parameters<typeof makeMemoryEntry>[0]> = {},
  ): Promise<void> {
    const entry = makeMemoryEntry(overrides);
    store.store(entry);
    const [embedding] = await embedder([entry.content]);
    await vectorStore.upsert([
      {
        id: entry.id,
        vector: embedding ?? [],
        metadata: {
          type: entry.type,
          agentId: entry.agentId ?? '',
        },
      },
    ]);
  }

  describe('search()', () => {
    test('performs vector search with query embedding', async () => {
      await storeWithEmbedding({ id: 'r1', content: 'TypeScript is great' });
      await storeWithEmbedding({ id: 'r2', content: 'Python is popular' });

      const result = await rag.search(
        { query: 'TypeScript is great', limit: 5 },
        vectorStore,
        store,
        embedder,
      );

      expect(result.entries.length).toBeGreaterThan(0);
    });

    test('returns MemorySearchResult with entries and totalCount', async () => {
      await storeWithEmbedding({ id: 's1', content: 'memory test' });

      const result = await rag.search(
        { query: 'memory test', limit: 10 },
        vectorStore,
        store,
        embedder,
      );

      expect(result.entries).toBeDefined();
      expect(Array.isArray(result.entries)).toBe(true);
      expect(typeof result.totalCount).toBe('number');
    });

    test('returns strategy: naive in result', async () => {
      await storeWithEmbedding({ id: 'strat1', content: 'test' });

      const result = await rag.search({ query: 'test', limit: 5 }, vectorStore, store, embedder);
      expect(result.strategy).toBe(RAGStrategy.NAIVE);
    });

    test('respects limit parameter', async () => {
      await storeWithEmbedding({ id: 'l1', content: 'entry one' });
      await storeWithEmbedding({ id: 'l2', content: 'entry two' });
      await storeWithEmbedding({ id: 'l3', content: 'entry three' });

      const result = await rag.search({ query: 'entry', limit: 2 }, vectorStore, store, embedder);
      expect(result.entries.length).toBeLessThanOrEqual(2);
    });

    test('returns empty result set for no matches', async () => {
      const result = await rag.search(
        { query: 'anything', limit: 5 },
        vectorStore,
        store,
        embedder,
      );
      expect(result.entries).toEqual([]);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('filtering', () => {
    beforeEach(async () => {
      await storeWithEmbedding({
        id: 'f1',
        content: 'long term from agent-a',
        type: MemoryType.LONG_TERM,
        agentId: 'agent-a',
      });
      await storeWithEmbedding({
        id: 'f2',
        content: 'short term from agent-a',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-a',
      });
      await storeWithEmbedding({
        id: 'f3',
        content: 'long term from agent-b',
        type: MemoryType.LONG_TERM,
        agentId: 'agent-b',
      });
    });

    test('applies type filter', async () => {
      const result = await rag.search(
        { query: 'term from agent', type: MemoryType.LONG_TERM, limit: 10 },
        vectorStore,
        store,
        embedder,
      );

      for (const entry of result.entries) {
        expect(entry.type).toBe('long-term');
      }
    });

    test('applies agentId filter', async () => {
      const result = await rag.search(
        { query: 'term from agent', agentId: 'agent-a', limit: 10 },
        vectorStore,
        store,
        embedder,
      );

      for (const entry of result.entries) {
        expect(entry.agentId).toBe('agent-a');
      }
    });

    test('combines vector similarity with metadata filters', async () => {
      const result = await rag.search(
        {
          query: 'long term from agent-a',
          type: MemoryType.LONG_TERM,
          agentId: 'agent-a',
          limit: 10,
        },
        vectorStore,
        store,
        embedder,
      );

      expect(result.entries.length).toBeLessThanOrEqual(1);
      if (result.entries.length > 0) {
        expect(result.entries[0]?.id).toBe('f1');
      }
    });
  });

  describe('end-to-end', () => {
    test('store -> embed -> search -> retrieve cycle', async () => {
      const content = 'The quick brown fox jumps over the lazy dog';
      await storeWithEmbedding({ id: 'e2e-1', content });

      const result = await rag.search({ query: content, limit: 1 }, vectorStore, store, embedder);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.content).toBe(content);
    });

    test('handles single entry in store', async () => {
      await storeWithEmbedding({ id: 'single', content: 'only entry' });

      const result = await rag.search(
        { query: 'only entry', limit: 10 },
        vectorStore,
        store,
        embedder,
      );
      expect(result.entries).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    test('handles empty query string', async () => {
      await storeWithEmbedding({ id: 'eq1', content: 'some content' });

      const result = await rag.search({ query: '', limit: 5 }, vectorStore, store, embedder);
      expect(result).toBeDefined();
      expect(result.strategy).toBe(RAGStrategy.NAIVE);
    });

    test('default limit when not specified', async () => {
      await storeWithEmbedding({ id: 'dl1', content: 'a' });
      await storeWithEmbedding({ id: 'dl2', content: 'b' });

      const result = await rag.search({ query: 'test' }, vectorStore, store, embedder);
      expect(result).toBeDefined();
      expect(result.entries.length).toBeGreaterThan(0);
    });
  });
});
