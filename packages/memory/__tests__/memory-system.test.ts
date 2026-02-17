import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { MemoryType, RAGStrategy, VectorProvider } from '@autonomy/shared';
import { Memory } from '../src/memory.ts';
import { registerProvider } from '../src/providers/index.ts';
import type { EmbeddingProvider } from '../src/rag/types.ts';
import { createFailingEmbedder, createMockEmbedder } from './helpers/mock-embedder.ts';
import { MockVectorStore } from './helpers/mock-vector-store.ts';

/**
 * Since Memory uses getProvider() internally, we register a MockVectorStore
 * under the 'lancedb' name so Memory can find it.
 */
function createTestMemory(
  embedder: EmbeddingProvider,
  mockVectorStore?: MockVectorStore,
): { memory: Memory; vectorStore: MockVectorStore } {
  const vs = mockVectorStore ?? new MockVectorStore();
  // Register mock under the lancedb name so getProvider('lancedb') returns it
  registerProvider(vs);

  const memory = new Memory({
    dataDir: ':memory:', // Will be used for SQLite path
    embedder,
    vectorProvider: VectorProvider.LANCEDB,
    dimensions: 8,
  });

  return { memory, vectorStore: vs };
}

describe('Memory (integration)', () => {
  let memory: Memory;
  let vectorStore: MockVectorStore;
  let embedder: EmbeddingProvider;

  beforeEach(async () => {
    embedder = createMockEmbedder(8);
    const result = createTestMemory(embedder);
    memory = result.memory;
    vectorStore = result.vectorStore;
    await memory.initialize();
  });

  afterEach(async () => {
    await memory.shutdown();
  });

  describe('initialize()', () => {
    test('initializes successfully', async () => {
      // Initialized in beforeEach — should be able to get stats
      const stats = await memory.stats();
      expect(stats.totalEntries).toBe(0);
    });

    test('initializes vector store', () => {
      expect(vectorStore.initialized).toBe(true);
    });

    test('is idempotent', async () => {
      await memory.initialize(); // second call should be no-op
      const stats = await memory.stats();
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe('store()', () => {
    test('stores a memory entry (short-term)', async () => {
      const stored = await memory.store({
        content: 'session data',
        type: MemoryType.SHORT_TERM,
        metadata: {},
      });
      expect(stored.type).toBe('short-term');
      expect(stored.content).toBe('session data');
      expect(stored.id).toBeDefined();
    });

    test('stores a memory entry (long-term)', async () => {
      const stored = await memory.store({
        content: 'persistent data',
        type: MemoryType.LONG_TERM,
        metadata: {},
      });
      expect(stored.type).toBe('long-term');
    });

    test('auto-generates id', async () => {
      const stored = await memory.store({
        content: 'auto id test',
        type: MemoryType.LONG_TERM,
        metadata: {},
      });
      expect(stored.id).toBeDefined();
      expect(stored.id.length).toBeGreaterThan(0);
    });

    test('uses provided id', async () => {
      const stored = await memory.store({
        id: 'custom-id',
        content: 'with id',
        type: MemoryType.LONG_TERM,
        metadata: {},
      });
      expect(stored.id).toBe('custom-id');
    });

    test('generates embedding and stores in vector store', async () => {
      await memory.store({
        content: 'embed check',
        type: MemoryType.LONG_TERM,
        metadata: {},
      });
      const vectorCount = await vectorStore.count();
      expect(vectorCount).toBe(1);
    });

    test('returns the stored entry with timestamp', async () => {
      const stored = await memory.store({
        content: 'hello',
        type: MemoryType.LONG_TERM,
        metadata: {},
      });
      expect(stored.createdAt).toBeDefined();
      // Should be a valid ISO 8601 string
      expect(new Date(stored.createdAt).toISOString()).toBe(stored.createdAt);
    });
  });

  describe('get()', () => {
    test('retrieves entry by id', async () => {
      const _stored = await memory.store({
        id: 'get-test',
        content: 'retrieve me',
        type: MemoryType.LONG_TERM,
        metadata: {},
      });

      const retrieved = await memory.get('get-test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('retrieve me');
    });

    test('returns null for non-existent id', async () => {
      const retrieved = await memory.get('nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('search()', () => {
    beforeEach(async () => {
      await memory.store({
        id: 'search-1',
        content: 'TypeScript programming language',
        type: MemoryType.LONG_TERM,
        agentId: 'agent-a',
        metadata: {},
      });
      await memory.store({
        id: 'search-2',
        content: 'Python data science',
        type: MemoryType.LONG_TERM,
        agentId: 'agent-b',
        metadata: {},
      });
      await memory.store({
        id: 'search-3',
        content: 'JavaScript web development',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-a',
        metadata: {},
      });
    });

    test('searches with naive RAG strategy (default)', async () => {
      const result = await memory.search({ query: 'TypeScript', limit: 5 });
      expect(result.strategy).toBe(RAGStrategy.NAIVE);
      expect(result.entries.length).toBeGreaterThan(0);
    });

    test('returns MemorySearchResult', async () => {
      const result = await memory.search({ query: 'programming', limit: 5 });
      expect(result.entries).toBeDefined();
      expect(typeof result.totalCount).toBe('number');
      expect(result.strategy).toBe(RAGStrategy.NAIVE);
    });
  });

  describe('delete()', () => {
    test('removes entry by id', async () => {
      await memory.store({
        id: 'del-1',
        content: 'delete me',
        type: MemoryType.LONG_TERM,
        metadata: {},
      });
      expect(await memory.get('del-1')).toBeDefined();

      const deleted = await memory.delete('del-1');
      expect(deleted).toBe(true);
      expect(await memory.get('del-1')).toBeNull();
    });

    test('returns false for non-existent id', async () => {
      const deleted = await memory.delete('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('clearSession()', () => {
    test('clears short-term entries for a session', async () => {
      await memory.store({
        id: 'st1',
        content: 'short 1',
        type: MemoryType.SHORT_TERM,
        sessionId: 'sess-1',
        metadata: {},
      });
      await memory.store({
        id: 'st2',
        content: 'short 2',
        type: MemoryType.SHORT_TERM,
        sessionId: 'sess-1',
        metadata: {},
      });
      await memory.store({
        id: 'lt1',
        content: 'long 1',
        type: MemoryType.LONG_TERM,
        sessionId: 'sess-1',
        metadata: {},
      });

      const cleared = await memory.clearSession('sess-1');
      expect(cleared).toBe(2);
      expect(await memory.get('lt1')).toBeDefined();
    });
  });

  describe('stats()', () => {
    test('returns MemoryStats with totalEntries', async () => {
      await memory.store({ id: 's1', content: 'a', type: MemoryType.LONG_TERM, metadata: {} });
      await memory.store({ id: 's2', content: 'b', type: MemoryType.LONG_TERM, metadata: {} });

      const stats = await memory.stats();
      expect(stats.totalEntries).toBe(2);
    });

    test('returns vectorCount', async () => {
      await memory.store({ id: 'vc1', content: 'a', type: MemoryType.LONG_TERM, metadata: {} });
      await memory.store({ id: 'vc2', content: 'b', type: MemoryType.LONG_TERM, metadata: {} });

      const stats = await memory.stats();
      expect(stats.vectorCount).toBe(2);
    });

    test('returns storageUsedBytes as a number', async () => {
      const stats = await memory.stats();
      expect(typeof stats.storageUsedBytes).toBe('number');
      expect(stats.storageUsedBytes).toBeGreaterThanOrEqual(0);
    });

    test('returns recentAccessCount as a number', async () => {
      const stats = await memory.stats();
      expect(typeof stats.recentAccessCount).toBe('number');
    });
  });

  describe('shutdown()', () => {
    test('shuts down gracefully', async () => {
      const { memory: m } = createTestMemory(embedder);
      await m.initialize();
      await m.shutdown();
      // Should not throw
    });

    test('is idempotent', async () => {
      const { memory: m } = createTestMemory(embedder);
      await m.initialize();
      await m.shutdown();
      await m.shutdown(); // should not throw
    });

    test('rejects operations after shutdown', async () => {
      const { memory: m } = createTestMemory(embedder);
      await m.initialize();
      await m.shutdown();

      expect(() => m.get('x')).toThrow();
    });
  });

  describe('error handling', () => {
    test('throws if not initialized', () => {
      const { memory: m } = createTestMemory(embedder);
      // Never called initialize()
      expect(() => m.get('x')).toThrow('not initialized');
    });

    test('wraps embedder errors', async () => {
      const failEmbedder = createFailingEmbedder(new Error('embed failure'));
      const { memory: m } = createTestMemory(failEmbedder);
      await m.initialize();

      try {
        await m.store({
          content: 'test',
          type: MemoryType.LONG_TERM,
          metadata: {},
        });
        expect(true).toBe(false); // Should not reach
      } catch (err) {
        expect(err).toBeDefined();
      }

      await m.shutdown();
    });
  });
});
