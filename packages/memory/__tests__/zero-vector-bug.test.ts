/**
 * Tests for zero-vector / identical-vector embedder handling.
 *
 * Root cause: When the stub embedder returns all-zero vectors for every input,
 * ALL entries have identical embeddings. The NaiveRAGEngine now detects this
 * and falls back to recency-based SQLite queries.
 *
 * Content filtering (preventing "hi" from being stored) is handled by the
 * Conductor layer, not the Memory/RAG layer.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { MemoryType, RAGStrategy, VectorProvider } from '@autonomy/shared';
import { Memory } from '../src/memory.ts';
import { registerProvider } from '../src/providers/index.ts';
import { NaiveRAGEngine } from '../src/rag/naive.ts';
import { SQLiteStore } from '../src/sqlite-store.ts';
import { makeMemoryEntry } from './helpers/fixtures.ts';
import { createFixedEmbedder, createMockEmbedder } from './helpers/mock-embedder.ts';
import { MockVectorStore } from './helpers/mock-vector-store.ts';

/**
 * Stub embedder identical to the OLD production server/src/index.ts:37-41.
 * Returns all-zero vectors for every input.
 */
function zeroEmbedder(texts: string[]): Promise<number[][]> {
  return Promise.resolve(texts.map(() => new Array(8).fill(0) as number[]));
}

describe('Zero-vector embedder fallback behavior', () => {
  describe('NaiveRAGEngine with zero vectors falls back to recency', () => {
    let store: SQLiteStore;
    let vectorStore: MockVectorStore;
    let rag: NaiveRAGEngine;

    beforeEach(async () => {
      store = new SQLiteStore(':memory:');
      vectorStore = new MockVectorStore();
      await vectorStore.initialize({ dataDir: '/tmp/test-zero', dimensions: 8 });
      rag = new NaiveRAGEngine();
    });

    afterEach(async () => {
      store.close();
      await vectorStore.shutdown();
    });

    test('zero-vector query falls back to SQLite recency query', async () => {
      // Store entries directly in SQLite (as the fallback reads from SQLite)
      const entry1 = makeMemoryEntry({
        id: 'msg-1',
        content: 'first message',
        createdAt: '2026-01-01T00:00:00Z',
      });
      const entry2 = makeMemoryEntry({
        id: 'msg-2',
        content: 'second message',
        createdAt: '2026-01-02T00:00:00Z',
      });
      const entry3 = makeMemoryEntry({
        id: 'msg-3',
        content: 'third message',
        createdAt: '2026-01-03T00:00:00Z',
      });
      store.store(entry1);
      store.store(entry2);
      store.store(entry3);

      // Search with zero-vector embedder — should fall back to recency
      const result = await rag.search(
        { query: 'anything', limit: 2 },
        vectorStore,
        store,
        zeroEmbedder,
      );

      // Fallback returns most recent entries first
      expect(result.entries.length).toBe(2);
      expect(result.entries[0]?.content).toBe('third message');
      expect(result.entries[1]?.content).toBe('second message');
    });

    test('zero-vector fallback does not use vector store at all', async () => {
      const entry = makeMemoryEntry({ id: 'msg-1', content: 'test content' });
      store.store(entry);

      await rag.search({ query: 'test', limit: 5 }, vectorStore, store, zeroEmbedder);

      // Vector store search should NOT have been called
      expect(vectorStore.searchCalls.length).toBe(0);
    });

    test('zero-vector fallback respects limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        store.store(makeMemoryEntry({ id: `msg-${i}`, content: `message ${i}` }));
      }

      const result = await rag.search(
        { query: 'test', limit: 3 },
        vectorStore,
        store,
        zeroEmbedder,
      );

      expect(result.entries.length).toBe(3);
    });

    test('zero-vector fallback respects type filter', async () => {
      store.store(
        makeMemoryEntry({ id: 'st-1', content: 'short term', type: MemoryType.SHORT_TERM }),
      );
      store.store(
        makeMemoryEntry({ id: 'lt-1', content: 'long term', type: MemoryType.LONG_TERM }),
      );

      const result = await rag.search(
        { query: 'test', limit: 5, type: MemoryType.SHORT_TERM },
        vectorStore,
        store,
        zeroEmbedder,
      );

      expect(result.entries.length).toBe(1);
      expect(result.entries[0]?.content).toBe('short term');
    });
  });

  describe('NaiveRAGEngine with identical non-zero vectors', () => {
    let store: SQLiteStore;
    let vectorStore: MockVectorStore;
    let rag: NaiveRAGEngine;

    beforeEach(async () => {
      store = new SQLiteStore(':memory:');
      vectorStore = new MockVectorStore();
      await vectorStore.initialize({ dataDir: '/tmp/test-fixed', dimensions: 8 });
      rag = new NaiveRAGEngine();
    });

    afterEach(async () => {
      store.close();
      await vectorStore.shutdown();
    });

    test('identical fixed vectors detected as degenerate, falls back to recency', async () => {
      const fixedVector = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const fixedEmbedder = createFixedEmbedder(fixedVector);

      const entries = [
        makeMemoryEntry({
          id: 'fix-1',
          content: 'Deploy Docker',
          createdAt: '2026-01-01T00:00:00Z',
        }),
        makeMemoryEntry({ id: 'fix-2', content: 'hi', createdAt: '2026-01-02T00:00:00Z' }),
        makeMemoryEntry({
          id: 'fix-3',
          content: 'CI/CD pipeline',
          createdAt: '2026-01-03T00:00:00Z',
        }),
      ];

      for (const entry of entries) {
        store.store(entry);
      }

      const result = await rag.search(
        { query: 'Deploy Docker', limit: 3 },
        vectorStore,
        store,
        fixedEmbedder,
      );

      // Falls back to recency — most recent first
      expect(result.entries[0]?.content).toBe('CI/CD pipeline');
      expect(result.strategy).toBe(RAGStrategy.NAIVE);
    });

    test('non-degenerate distinct vectors use vector search normally', async () => {
      const goodEmbedder = createMockEmbedder(8);

      const entries = [
        makeMemoryEntry({ id: 'good-1', content: 'Rust systems programming' }),
        makeMemoryEntry({ id: 'good-2', content: 'Italian pasta recipes' }),
        makeMemoryEntry({ id: 'good-3', content: 'hi' }),
      ];

      for (const entry of entries) {
        store.store(entry);
        const [vec] = await goodEmbedder([entry.content]);
        await vectorStore.upsert([
          {
            id: entry.id,
            vector: vec ?? [],
            metadata: { type: entry.type, agentId: entry.agentId ?? '' },
          },
        ]);
      }

      const result = await rag.search(
        { query: 'Rust systems programming', limit: 1 },
        vectorStore,
        store,
        goodEmbedder,
      );

      expect(result.entries.length).toBe(1);
      expect(result.entries[0]?.content).toBe('Rust systems programming');
    });
  });

  describe('Memory class integration with zero-vector embedder', () => {
    let memory: Memory;
    let vectorStore: MockVectorStore;

    beforeEach(async () => {
      vectorStore = new MockVectorStore();
      registerProvider(vectorStore);

      memory = new Memory({
        dataDir: ':memory:',
        embedder: zeroEmbedder,
        vectorProvider: VectorProvider.LANCEDB,
        dimensions: 8,
      });
      await memory.initialize();
    });

    afterEach(async () => {
      await memory.shutdown();
    });

    test('Memory.search with zero-vector embedder returns recency-ordered results', async () => {
      await memory.store({
        id: 'u1',
        content: 'early message',
        type: MemoryType.SHORT_TERM,
        agentId: 'user',
        metadata: {},
        createdAt: '2026-01-01T00:00:00Z',
      });
      await memory.store({
        id: 'u2',
        content: 'later message about TypeScript',
        type: MemoryType.SHORT_TERM,
        agentId: 'user',
        metadata: {},
        createdAt: '2026-01-02T00:00:00Z',
      });

      const result = await memory.search({
        query: 'TypeScript',
        limit: 5,
      });

      // With zero vectors, falls back to recency — most recent first
      expect(result.entries[0]?.content).toBe('later message about TypeScript');
    });

    test('Memory.search with zero embedder returns results in recency order, not random', async () => {
      // Store 5 messages with distinct timestamps
      const messages = [
        { id: 'm1', content: 'first', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'm2', content: 'second', createdAt: '2026-01-02T00:00:00Z' },
        { id: 'm3', content: 'third', createdAt: '2026-01-03T00:00:00Z' },
        { id: 'm4', content: 'fourth', createdAt: '2026-01-04T00:00:00Z' },
        { id: 'm5', content: 'fifth', createdAt: '2026-01-05T00:00:00Z' },
      ];

      for (const msg of messages) {
        await memory.store({
          ...msg,
          type: MemoryType.SHORT_TERM,
          metadata: {},
        });
      }

      const result = await memory.search({ query: 'anything', limit: 3 });

      // Should be most recent first (not random/arbitrary order)
      expect(result.entries[0]?.content).toBe('fifth');
      expect(result.entries[1]?.content).toBe('fourth');
      expect(result.entries[2]?.content).toBe('third');
    });
  });
});

describe('Degenerate input edge cases', () => {
  let store: SQLiteStore;
  let vectorStore: MockVectorStore;
  let rag: NaiveRAGEngine;

  beforeEach(async () => {
    store = new SQLiteStore(':memory:');
    vectorStore = new MockVectorStore();
    await vectorStore.initialize({ dataDir: '/tmp/test-edge', dimensions: 8 });
    rag = new NaiveRAGEngine();
  });

  afterEach(async () => {
    store.close();
    await vectorStore.shutdown();
  });

  test('search with proper embedder correctly discriminates content', async () => {
    const goodEmbedder = createMockEmbedder(8);

    const entries = [
      makeMemoryEntry({ id: 'good-1', content: 'Rust systems programming' }),
      makeMemoryEntry({ id: 'good-2', content: 'Italian pasta recipes' }),
      makeMemoryEntry({ id: 'good-3', content: 'hi' }),
    ];

    for (const entry of entries) {
      store.store(entry);
      const [vec] = await goodEmbedder([entry.content]);
      await vectorStore.upsert([
        {
          id: entry.id,
          vector: vec ?? [],
          metadata: { type: entry.type, agentId: entry.agentId ?? '' },
        },
      ]);
    }

    const result = await rag.search(
      { query: 'Rust systems programming', limit: 1 },
      vectorStore,
      store,
      goodEmbedder,
    );

    expect(result.entries.length).toBe(1);
    expect(result.entries[0]?.content).toBe('Rust systems programming');
  });

  test('zero-vector search with empty store returns empty results', async () => {
    const result = await rag.search(
      { query: 'test query', limit: 5 },
      vectorStore,
      store,
      zeroEmbedder,
    );

    expect(result.entries.length).toBe(0);
  });

  test('zero-vector fallback gracefully handles single entry', async () => {
    store.store(makeMemoryEntry({ id: 'only-1', content: 'the only entry' }));

    const result = await rag.search(
      { query: 'anything', limit: 5 },
      vectorStore,
      store,
      zeroEmbedder,
    );

    expect(result.entries.length).toBe(1);
    expect(result.entries[0]?.content).toBe('the only entry');
  });
});
