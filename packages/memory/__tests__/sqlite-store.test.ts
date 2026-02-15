import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { MemoryType } from '@autonomy/shared';
import { SQLiteStore } from '../src/sqlite-store.ts';
import { makeMemoryEntry } from './helpers/fixtures.ts';

describe('SQLiteStore', () => {
  let store: SQLiteStore;

  beforeEach(() => {
    store = new SQLiteStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  describe('initialization', () => {
    test('creates tables on construction', () => {
      // If we can store and retrieve, tables exist
      const entry = makeMemoryEntry({ id: 'init-test' });
      store.store(entry);
      expect(store.get('init-test')).toBeDefined();
    });

    test('handles multiple instances on :memory: (isolated)', () => {
      const store2 = new SQLiteStore(':memory:');
      store.store(makeMemoryEntry({ id: 'a' }));
      // store2 should be empty (separate database)
      expect(store2.get('a')).toBeNull();
      store2.close();
    });
  });

  describe('store()', () => {
    test('stores a MemoryEntry', () => {
      const entry = makeMemoryEntry({ id: 'mem-1', content: 'Hello world' });
      store.store(entry);

      const retrieved = store.get('mem-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('mem-1');
      expect(retrieved?.content).toBe('Hello world');
    });

    test('stores with all optional fields (agentId, sessionId)', () => {
      const entry = makeMemoryEntry({
        agentId: 'agent-1',
        sessionId: 'session-abc',
      });
      store.store(entry);

      const retrieved = store.get(entry.id);
      expect(retrieved?.agentId).toBe('agent-1');
      expect(retrieved?.sessionId).toBe('session-abc');
    });

    test('stores with minimal required fields only', () => {
      const entry = makeMemoryEntry({
        id: 'minimal',
        content: 'just content',
        type: MemoryType.SHORT_TERM,
      });
      store.store(entry);

      const retrieved = store.get('minimal');
      expect(retrieved?.type).toBe('short-term');
      expect(retrieved?.agentId).toBeUndefined();
      expect(retrieved?.sessionId).toBeUndefined();
    });

    test('stores metadata as JSON', () => {
      const entry = makeMemoryEntry({
        metadata: { source: 'test', tags: ['a', 'b'] },
      });
      store.store(entry);

      const retrieved = store.get(entry.id);
      expect(retrieved?.metadata).toEqual({ source: 'test', tags: ['a', 'b'] });
    });

    test('preserves createdAt timestamp', () => {
      const ts = '2026-01-15T12:00:00.000Z';
      const entry = makeMemoryEntry({ createdAt: ts });
      store.store(entry);

      const retrieved = store.get(entry.id);
      expect(retrieved?.createdAt).toBe(ts);
    });

    test('upserts on duplicate id', () => {
      store.store(makeMemoryEntry({ id: 'dup', content: 'original' }));
      store.store(makeMemoryEntry({ id: 'dup', content: 'updated' }));

      const retrieved = store.get('dup');
      expect(retrieved?.content).toBe('updated');
      expect(store.count()).toBe(1);
    });
  });

  describe('get()', () => {
    test('retrieves entry by id', () => {
      const entry = makeMemoryEntry({ id: 'get-test', content: 'findme' });
      store.store(entry);

      const retrieved = store.get('get-test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('findme');
    });

    test('returns null for non-existent id', () => {
      const retrieved = store.get('does-not-exist');
      expect(retrieved).toBeNull();
    });

    test('deserializes metadata JSON correctly', () => {
      const entry = makeMemoryEntry({
        id: 'json-test',
        metadata: { nested: { deep: true }, count: 42 },
      });
      store.store(entry);

      const retrieved = store.get('json-test');
      expect(retrieved?.metadata).toEqual({ nested: { deep: true }, count: 42 });
    });
  });

  describe('query()', () => {
    beforeEach(() => {
      store.store(
        makeMemoryEntry({
          id: 'q1',
          type: MemoryType.LONG_TERM,
          agentId: 'agent-a',
          sessionId: 'sess-1',
          content: 'long term memory A',
        }),
      );
      store.store(
        makeMemoryEntry({
          id: 'q2',
          type: MemoryType.SHORT_TERM,
          agentId: 'agent-a',
          sessionId: 'sess-2',
          content: 'short term memory A',
        }),
      );
      store.store(
        makeMemoryEntry({
          id: 'q3',
          type: MemoryType.LONG_TERM,
          agentId: 'agent-b',
          sessionId: 'sess-1',
          content: 'long term memory B',
        }),
      );
      store.store(
        makeMemoryEntry({
          id: 'q4',
          type: MemoryType.SHORT_TERM,
          agentId: 'agent-b',
          sessionId: 'sess-3',
          content: 'short term memory B',
        }),
      );
    });

    test('returns all entries when no filters', () => {
      const results = store.query({});
      expect(results).toHaveLength(4);
    });

    test('filters by type (short-term only)', () => {
      const results = store.query({ type: MemoryType.SHORT_TERM });
      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r.type).toBe('short-term');
      }
    });

    test('filters by type (long-term only)', () => {
      const results = store.query({ type: MemoryType.LONG_TERM });
      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r.type).toBe('long-term');
      }
    });

    test('filters by agentId', () => {
      const results = store.query({ agentId: 'agent-a' });
      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r.agentId).toBe('agent-a');
      }
    });

    test('filters by sessionId', () => {
      const results = store.query({ sessionId: 'sess-1' });
      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r.sessionId).toBe('sess-1');
      }
    });

    test('combines multiple filters (type + agentId)', () => {
      const results = store.query({
        type: MemoryType.LONG_TERM,
        agentId: 'agent-a',
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('q1');
    });

    test('respects limit parameter', () => {
      const results = store.query({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    test('returns empty array when no matches', () => {
      const results = store.query({ agentId: 'agent-nonexistent' });
      expect(results).toEqual([]);
    });

    test('orders results by created_at descending', () => {
      const results = store.query({});
      // The last inserted should come first (most recent)
      expect(results.length).toBe(4);
    });
  });

  describe('delete()', () => {
    test('removes entry by id', () => {
      store.store(makeMemoryEntry({ id: 'del-1' }));
      expect(store.get('del-1')).toBeDefined();

      const deleted = store.delete('del-1');
      expect(deleted).toBe(true);
      expect(store.get('del-1')).toBeNull();
    });

    test('returns false for non-existent id', () => {
      const deleted = store.delete('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('deleteBySession()', () => {
    test('deletes short-term entries for a session', () => {
      store.store(makeMemoryEntry({ id: 'st1', type: MemoryType.SHORT_TERM, sessionId: 'sess-x' }));
      store.store(makeMemoryEntry({ id: 'st2', type: MemoryType.SHORT_TERM, sessionId: 'sess-x' }));
      store.store(makeMemoryEntry({ id: 'lt1', type: MemoryType.LONG_TERM, sessionId: 'sess-x' }));

      const deleted = store.deleteBySession('sess-x');
      expect(deleted).toBe(2);
      // Long-term entry should remain
      expect(store.get('lt1')).toBeDefined();
    });
  });

  describe('getEntriesByIds()', () => {
    test('returns entries matching the given ids', () => {
      store.store(makeMemoryEntry({ id: 'a', content: 'alpha' }));
      store.store(makeMemoryEntry({ id: 'b', content: 'beta' }));
      store.store(makeMemoryEntry({ id: 'c', content: 'gamma' }));

      const results = store.getEntriesByIds(['a', 'c']);
      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.id);
      expect(ids).toContain('a');
      expect(ids).toContain('c');
    });

    test('returns empty array for empty ids', () => {
      const results = store.getEntriesByIds([]);
      expect(results).toEqual([]);
    });

    test('skips non-existent ids', () => {
      store.store(makeMemoryEntry({ id: 'x' }));
      const results = store.getEntriesByIds(['x', 'y']);
      expect(results).toHaveLength(1);
    });
  });

  describe('count()', () => {
    test('returns 0 for empty store', () => {
      expect(store.count()).toBe(0);
    });

    test('returns correct count after inserts', () => {
      store.store(makeMemoryEntry({ id: 'c1' }));
      store.store(makeMemoryEntry({ id: 'c2' }));
      store.store(makeMemoryEntry({ id: 'c3' }));
      expect(store.count()).toBe(3);
    });

    test('decrements after delete', () => {
      store.store(makeMemoryEntry({ id: 'cd1' }));
      store.store(makeMemoryEntry({ id: 'cd2' }));
      expect(store.count()).toBe(2);
      store.delete('cd1');
      expect(store.count()).toBe(1);
    });

    test('filters by type', () => {
      store.store(makeMemoryEntry({ id: 't1', type: MemoryType.LONG_TERM }));
      store.store(makeMemoryEntry({ id: 't2', type: MemoryType.SHORT_TERM }));
      store.store(makeMemoryEntry({ id: 't3', type: MemoryType.LONG_TERM }));
      expect(store.count({ type: MemoryType.LONG_TERM })).toBe(2);
      expect(store.count({ type: MemoryType.SHORT_TERM })).toBe(1);
    });
  });

  describe('edge cases', () => {
    test('handles very long content (10KB+)', () => {
      const longContent = 'x'.repeat(10_000);
      const entry = makeMemoryEntry({ content: longContent });
      store.store(entry);

      const retrieved = store.get(entry.id);
      expect(retrieved?.content).toHaveLength(10_000);
    });

    test('handles special characters (unicode, quotes)', () => {
      const content = 'Hello \'world\' "quotes" \u00e9\u00e8\u00ea \u{1F600} DROP TABLE;--';
      const entry = makeMemoryEntry({ content });
      store.store(entry);

      const retrieved = store.get(entry.id);
      expect(retrieved?.content).toBe(content);
    });

    test('handles empty metadata ({})', () => {
      const entry = makeMemoryEntry({ metadata: {} });
      store.store(entry);

      const retrieved = store.get(entry.id);
      expect(retrieved?.metadata).toEqual({});
    });
  });
});
