import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { MockVectorStore } from './helpers/mock-vector-store.ts';

describe('VectorStore contract tests (MockVectorStore)', () => {
  let provider: MockVectorStore;

  beforeEach(async () => {
    provider = new MockVectorStore();
    await provider.initialize({ dataDir: '/tmp/test-vectors', dimensions: 3 });
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  describe('initialization', () => {
    test('initializes without error', () => {
      expect(provider.initialized).toBe(true);
    });

    test('reports not ready before init', () => {
      const fresh = new MockVectorStore();
      expect(fresh.initialized).toBe(false);
    });

    test('stores config on init', () => {
      expect(provider.config).toBeDefined();
      expect(provider.config?.dimensions).toBe(3);
    });
  });

  describe('upsert()', () => {
    test('stores vectors', async () => {
      await provider.upsert([{ id: 'v1', vector: [0.1, 0.2, 0.3], metadata: {} }]);
      const count = await provider.count();
      expect(count).toBe(1);
    });

    test('updates existing vector by id', async () => {
      await provider.upsert([{ id: 'v1', vector: [0.1, 0.2, 0.3], metadata: {} }]);
      await provider.upsert([{ id: 'v1', vector: [0.4, 0.5, 0.6], metadata: {} }]);
      const count = await provider.count();
      expect(count).toBe(1);
    });

    test('handles batch upsert (multiple vectors)', async () => {
      await provider.upsert([
        { id: 'v1', vector: [0.1, 0.2, 0.3], metadata: {} },
        { id: 'v2', vector: [0.4, 0.5, 0.6], metadata: {} },
        { id: 'v3', vector: [0.7, 0.8, 0.9], metadata: {} },
      ]);
      const count = await provider.count();
      expect(count).toBe(3);
    });

    test('stores metadata alongside vector', async () => {
      await provider.upsert([
        { id: 'v1', vector: [0.1, 0.2, 0.3], metadata: { type: 'long-term' } },
      ]);
      const results = await provider.search([0.1, 0.2, 0.3], 1);
      expect(results[0]?.metadata.type).toBe('long-term');
    });

    test('records upsert calls for assertions', async () => {
      await provider.upsert([{ id: 'v1', vector: [1, 2, 3], metadata: {} }]);
      expect(provider.upsertCalls).toHaveLength(1);
      expect(provider.upsertCalls[0]?.[0]?.id).toBe('v1');
    });
  });

  describe('search()', () => {
    beforeEach(async () => {
      await provider.upsert([
        { id: 'similar', vector: [1.0, 0.0, 0.0], metadata: {} },
        { id: 'different', vector: [0.0, 1.0, 0.0], metadata: {} },
        { id: 'opposite', vector: [-1.0, 0.0, 0.0], metadata: {} },
      ]);
    });

    test('returns top-K nearest vectors', async () => {
      const results = await provider.search([1.0, 0.0, 0.0], 3);
      expect(results).toHaveLength(3);
    });

    test('respects limit parameter', async () => {
      const results = await provider.search([1.0, 0.0, 0.0], 1);
      expect(results).toHaveLength(1);
    });

    test('returns empty array for empty collection', async () => {
      const empty = new MockVectorStore();
      await empty.initialize({ dataDir: '/tmp/e', dimensions: 3 });
      const results = await empty.search([1.0, 0.0, 0.0], 5);
      expect(results).toEqual([]);
      await empty.shutdown();
    });

    test('returns results with similarity scores', async () => {
      const results = await provider.search([1.0, 0.0, 0.0], 3);
      for (const result of results) {
        expect(typeof result.score).toBe('number');
      }
    });

    test('returns results ordered by relevance (highest first)', async () => {
      const results = await provider.search([1.0, 0.0, 0.0], 3);
      expect(results[0]?.id).toBe('similar');
      expect(results[0]?.score).toBeGreaterThan(results[1]?.score);
    });

    test('similar vectors score higher than dissimilar ones', async () => {
      const results = await provider.search([0.9, 0.1, 0.0], 3);
      const similarResult = results.find((r) => r.id === 'similar');
      const differentResult = results.find((r) => r.id === 'different');
      expect(similarResult?.score).toBeGreaterThan(differentResult?.score);
    });

    test('applies type filter', async () => {
      await provider.upsert([
        { id: 'lt', vector: [0.5, 0.5, 0], metadata: { type: 'long-term' } },
        { id: 'st', vector: [0.5, 0.5, 0], metadata: { type: 'short-term' } },
      ]);
      const results = await provider.search([0.5, 0.5, 0], 10, { type: 'long-term' });
      expect(results.every((r) => r.metadata.type === 'long-term')).toBe(true);
    });

    test('applies agentId filter', async () => {
      await provider.upsert([
        { id: 'a1', vector: [0.5, 0.5, 0], metadata: { agentId: 'agent-x' } },
        { id: 'a2', vector: [0.5, 0.5, 0], metadata: { agentId: 'agent-y' } },
      ]);
      const results = await provider.search([0.5, 0.5, 0], 10, { agentId: 'agent-x' });
      expect(results.every((r) => r.metadata.agentId === 'agent-x')).toBe(true);
    });
  });

  describe('delete()', () => {
    test('removes vectors by ids', async () => {
      await provider.upsert([{ id: 'v1', vector: [0.1, 0.2, 0.3], metadata: {} }]);
      expect(await provider.count()).toBe(1);
      await provider.delete(['v1']);
      expect(await provider.count()).toBe(0);
    });

    test('is no-op for non-existent ids', async () => {
      await provider.delete(['nonexistent']);
      expect(await provider.count()).toBe(0);
    });
  });

  describe('shutdown()', () => {
    test('clears all vectors', async () => {
      await provider.upsert([{ id: 'v1', vector: [1, 2, 3], metadata: {} }]);
      await provider.shutdown();
      expect(provider.initialized).toBe(false);
    });

    test('is idempotent', async () => {
      await provider.shutdown();
      await provider.shutdown(); // should not throw
    });
  });

  describe('error handling', () => {
    test('propagates errors from upsert', async () => {
      provider.errorToThrow = new Error('upsert failed');
      await expect(provider.upsert([{ id: 'v1', vector: [0.1], metadata: {} }])).rejects.toThrow(
        'upsert failed',
      );
    });

    test('propagates errors from search', async () => {
      provider.errorToThrow = new Error('search failed');
      await expect(provider.search([0.1], 5)).rejects.toThrow('search failed');
    });
  });
});
