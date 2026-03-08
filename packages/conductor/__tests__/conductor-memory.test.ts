import { beforeEach, describe, expect, test } from 'bun:test';
import type { ConductorDecision, MemoryInterface } from '@autonomy/shared';
import { HookName, MemoryType, RAGStrategy } from '@autonomy/shared';
import type { StoreConversationContext } from '../src/conductor-memory.ts';
import { searchMemoryContext, storeConversation } from '../src/conductor-memory.ts';
import { MockMemory } from './helpers/mock-memory.ts';
import { createMockRegistry, makeMessage } from './helpers/mock-registry.ts';

describe('searchMemoryContext', () => {
  let memory: MockMemory;

  beforeEach(() => {
    memory = new MockMemory();
  });

  test('searches memory with correct parameters', async () => {
    const msg = makeMessage();
    await searchMemoryContext(memory, msg);
    expect(memory.searchCalls).toHaveLength(1);
    expect(memory.searchCalls[0].query).toBe('Hello world');
    expect(memory.searchCalls[0].limit).toBe(5);
    expect(memory.searchCalls[0].strategy).toBe(RAGStrategy.HYBRID);
  });

  test('includes agentId when sessionId is present', async () => {
    const msg = makeMessage({ sessionId: 'sess-1', senderId: 'agent-1' });
    await searchMemoryContext(memory, msg);
    expect(memory.searchCalls[0].agentId).toBe('agent-1');
  });

  test('omits agentId when sessionId is absent', async () => {
    const msg = makeMessage({ sessionId: undefined });
    await searchMemoryContext(memory, msg);
    expect(memory.searchCalls[0].agentId).toBeUndefined();
  });

  test('returns search results on success', async () => {
    const expected = { entries: [], totalCount: 0, strategy: RAGStrategy.NAIVE };
    memory.setSearchResults(expected);
    const msg = makeMessage();
    const result = await searchMemoryContext(memory, msg);
    expect(result).toEqual(expected);
  });

  test('returns null on search failure', async () => {
    memory.setShouldThrow(true);
    const msg = makeMessage();
    const result = await searchMemoryContext(memory, msg);
    expect(result).toBeNull();
  });

  describe('deduplication', () => {
    test('removes entries with identical content from search results', async () => {
      const duplicateEntry = {
        id: 'mem-1',
        content: 'My favorite color is blue',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        sessionId: 'sess-1',
        metadata: { senderName: 'TestAgent' },
        createdAt: '2026-03-01T00:00:00Z',
      };
      const duplicateEntry2 = {
        ...duplicateEntry,
        id: 'mem-2',
        sessionId: 'sess-2',
        createdAt: '2026-03-02T00:00:00Z',
      };
      memory.setSearchResults({
        entries: [duplicateEntry, duplicateEntry2],
        totalCount: 2,
        strategy: RAGStrategy.HYBRID,
      });

      const msg = makeMessage({ content: 'What is my favorite color?' });
      const result = await searchMemoryContext(memory, msg);

      expect(result).not.toBeNull();
      expect(result!.entries).toHaveLength(1);
      expect(result!.entries[0].content).toBe('My favorite color is blue');
    });

    test('removes entries with identical contentHash from search results', async () => {
      const hash = 'abc123hash';
      const entry1 = {
        id: 'mem-1',
        content: 'My favorite color is blue',
        contentHash: hash,
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        sessionId: 'sess-1',
        metadata: {},
        createdAt: '2026-03-01T00:00:00Z',
      };
      const entry2 = {
        id: 'mem-2',
        content: 'My favorite color is blue',
        contentHash: hash,
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        sessionId: 'sess-2',
        metadata: {},
        createdAt: '2026-03-02T00:00:00Z',
      };
      memory.setSearchResults({
        entries: [entry1, entry2],
        totalCount: 2,
        strategy: RAGStrategy.HYBRID,
      });

      const msg = makeMessage({ content: 'favorite color' });
      const result = await searchMemoryContext(memory, msg);

      expect(result).not.toBeNull();
      expect(result!.entries).toHaveLength(1);
    });

    test('keeps entries with different content', async () => {
      const entry1 = {
        id: 'mem-1',
        content: 'My favorite color is blue',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        metadata: {},
        createdAt: '2026-03-01T00:00:00Z',
      };
      const entry2 = {
        id: 'mem-2',
        content: 'My favorite food is pizza',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        metadata: {},
        createdAt: '2026-03-02T00:00:00Z',
      };
      memory.setSearchResults({
        entries: [entry1, entry2],
        totalCount: 2,
        strategy: RAGStrategy.HYBRID,
      });

      const msg = makeMessage({ content: 'What are my favorites?' });
      const result = await searchMemoryContext(memory, msg);

      expect(result).not.toBeNull();
      expect(result!.entries).toHaveLength(2);
    });

    test('deduplicates entries from different agentIds with same content', async () => {
      const entry1 = {
        id: 'mem-1',
        content: 'Remember: user prefers dark mode',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        metadata: {},
        createdAt: '2026-03-01T00:00:00Z',
      };
      const entry2 = {
        id: 'mem-2',
        content: 'Remember: user prefers dark mode',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-2',
        metadata: {},
        createdAt: '2026-03-02T00:00:00Z',
      };
      memory.setSearchResults({
        entries: [entry1, entry2],
        totalCount: 2,
        strategy: RAGStrategy.HYBRID,
      });

      const msg = makeMessage({ content: 'dark mode' });
      const result = await searchMemoryContext(memory, msg);

      expect(result).not.toBeNull();
      expect(result!.entries).toHaveLength(1);
    });

    test('deduplicates entries with different types but same content', async () => {
      const entry1 = {
        id: 'mem-1',
        content: 'The project deadline is March 15',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        metadata: {},
        createdAt: '2026-03-01T00:00:00Z',
      };
      const entry2 = {
        id: 'mem-2',
        content: 'The project deadline is March 15',
        type: MemoryType.LONG_TERM,
        agentId: 'agent-1',
        metadata: {},
        createdAt: '2026-03-02T00:00:00Z',
      };
      memory.setSearchResults({
        entries: [entry1, entry2],
        totalCount: 2,
        strategy: RAGStrategy.HYBRID,
      });

      const msg = makeMessage({ content: 'deadline' });
      const result = await searchMemoryContext(memory, msg);

      expect(result).not.toBeNull();
      expect(result!.entries).toHaveLength(1);
    });

    test('deduplicates scored entries when scoredEntries is present', async () => {
      const entry1 = {
        id: 'mem-1',
        content: 'Duplicate fact',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        metadata: {},
        createdAt: '2026-03-01T00:00:00Z',
      };
      const entry2 = {
        id: 'mem-2',
        content: 'Duplicate fact',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        metadata: {},
        createdAt: '2026-03-02T00:00:00Z',
      };
      memory.setSearchResults({
        entries: [entry1, entry2],
        totalCount: 2,
        strategy: RAGStrategy.HYBRID,
        scoredEntries: [
          { entry: entry1, score: 0.95 },
          { entry: entry2, score: 0.9 },
        ],
      });

      const msg = makeMessage({ content: 'duplicate' });
      const result = await searchMemoryContext(memory, msg);

      expect(result).not.toBeNull();
      expect(result!.entries).toHaveLength(1);
      if (result!.scoredEntries) {
        expect(result!.scoredEntries).toHaveLength(1);
        // Should keep the higher-scored entry
        expect(result!.scoredEntries[0].score).toBe(0.95);
      }
    });

    test('updates totalCount to match deduplicated entries', async () => {
      const entry1 = {
        id: 'mem-1',
        content: 'Same content',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        metadata: {},
        createdAt: '2026-03-01T00:00:00Z',
      };
      const entry2 = {
        id: 'mem-2',
        content: 'Same content',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        metadata: {},
        createdAt: '2026-03-02T00:00:00Z',
      };
      const entry3 = {
        id: 'mem-3',
        content: 'Different content',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        metadata: {},
        createdAt: '2026-03-03T00:00:00Z',
      };
      memory.setSearchResults({
        entries: [entry1, entry2, entry3],
        totalCount: 3,
        strategy: RAGStrategy.HYBRID,
      });

      const msg = makeMessage({ content: 'search' });
      const result = await searchMemoryContext(memory, msg);

      expect(result).not.toBeNull();
      expect(result!.entries).toHaveLength(2);
      expect(result!.totalCount).toBe(2);
    });

    test('handles triple duplicates correctly', async () => {
      const entries = [1, 2, 3].map((i) => ({
        id: `mem-${i}`,
        content: 'I repeat myself three times',
        type: MemoryType.SHORT_TERM,
        agentId: 'agent-1',
        metadata: {},
        createdAt: `2026-03-0${i}T00:00:00Z`,
      }));
      memory.setSearchResults({
        entries,
        totalCount: 3,
        strategy: RAGStrategy.HYBRID,
      });

      const msg = makeMessage({ content: 'repeat' });
      const result = await searchMemoryContext(memory, msg);

      expect(result).not.toBeNull();
      expect(result!.entries).toHaveLength(1);
    });
  });
});

describe('storeConversation', () => {
  let memory: MockMemory;
  let ctx: StoreConversationContext;
  let decisions: ConductorDecision[];

  beforeEach(() => {
    memory = new MockMemory();
    ctx = { memory: memory as unknown as MemoryInterface, memoryConnected: true };
    decisions = [];
  });

  test('skips storage when memory is not connected', async () => {
    ctx.memoryConnected = false;
    const msg = makeMessage();
    await storeConversation(ctx, msg, decisions);
    expect(memory.storeCalls).toHaveLength(0);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].action).toBe('skip_memory');
    expect(decisions[0].reason).toBe('Memory service not connected');
  });

  test('skips storage when message content is empty', async () => {
    const msg = makeMessage({ content: '   ' });
    await storeConversation(ctx, msg, decisions);
    expect(memory.storeCalls).toHaveLength(0);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].action).toBe('skip_memory');
    expect(decisions[0].reason).toBe('Empty message content');
  });

  test('stores user message in SHORT_TERM memory', async () => {
    const msg = makeMessage();
    await storeConversation(ctx, msg, decisions);
    expect(memory.storeCalls).toHaveLength(1);
    expect(memory.storeCalls[0].content).toBe('Hello world');
    expect(memory.storeCalls[0].type).toBe(MemoryType.SHORT_TERM);
  });

  test('stores assistant response in EPISODIC memory', async () => {
    const msg = makeMessage();
    await storeConversation(ctx, msg, decisions, 'Assistant reply');
    expect(memory.storeCalls).toHaveLength(2);
    expect(memory.storeCalls[1].content).toBe('Assistant reply');
    expect(memory.storeCalls[1].type).toBe(MemoryType.EPISODIC);
  });

  test('does not store empty assistant response', async () => {
    const msg = makeMessage();
    await storeConversation(ctx, msg, decisions, '   ');
    expect(memory.storeCalls).toHaveLength(1);
  });

  test('does not store undefined assistant response', async () => {
    const msg = makeMessage();
    await storeConversation(ctx, msg, decisions, undefined);
    expect(memory.storeCalls).toHaveLength(1);
  });

  test('pushes store_memory decision on success', async () => {
    const msg = makeMessage();
    await storeConversation(ctx, msg, decisions);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].action).toBe('store_memory');
  });

  test('handles memory store error gracefully', async () => {
    memory.setShouldThrow(true);
    const msg = makeMessage();
    await storeConversation(ctx, msg, decisions);
    // Failure decision pushed, no exception thrown
    const failDecisions = decisions.filter((d) => d.action === 'store_memory_failed');
    expect(failDecisions.length).toBeGreaterThanOrEqual(1);
  });

  test('produces deterministic IDs — same content yields same store ID', async () => {
    const msg = makeMessage({ content: 'Remember this fact' });
    await storeConversation(ctx, msg, decisions);
    const firstId = memory.storeCalls[0].id;

    // Reset and store again
    memory.storeCalls = [];
    await storeConversation(ctx, msg, []);
    const secondId = memory.storeCalls[0].id;

    expect(firstId).toBeDefined();
    expect(firstId).toBe(secondId);
  });

  test('produces different IDs for different content', async () => {
    const msg1 = makeMessage({ content: 'First message' });
    await storeConversation(ctx, msg1, decisions);
    const firstId = memory.storeCalls[0].id;

    const msg2 = makeMessage({ content: 'Second message' });
    await storeConversation(ctx, msg2, []);
    const secondId = memory.storeCalls[1].id;

    expect(firstId).not.toBe(secondId);
  });

  test('user message and assistant response get different IDs even with same content', async () => {
    const msg = makeMessage({ content: 'Hello' });
    await storeConversation(ctx, msg, decisions, 'Hello');
    expect(memory.storeCalls).toHaveLength(2);
    expect(memory.storeCalls[0].id).not.toBe(memory.storeCalls[1].id);
  });

  test('stores assistant response even when user message store fails', async () => {
    let callCount = 0;
    const origStore = memory.store.bind(memory);
    memory.store = async (entry) => {
      callCount++;
      if (callCount === 1) throw new Error('First store fails');
      return origStore(entry);
    };
    const msg = makeMessage();
    await storeConversation(ctx, msg, decisions, 'Assistant reply');
    // Both store calls attempted, second succeeded
    expect(callCount).toBe(2);
    const failDecisions = decisions.filter((d) => d.action === 'store_memory_failed');
    expect(failDecisions).toHaveLength(1);
  });

  describe('BEFORE_MEMORY_STORE hook', () => {
    test('calls hook with correct data', async () => {
      const msg = makeMessage();
      const registry = createMockRegistry({
        content: 'Hello world',
        metadata: { senderName: 'TestAgent' },
      });
      ctx.hookRegistry = registry;
      await storeConversation(ctx, msg, decisions);
      expect(registry.calls).toHaveLength(1);
      expect(registry.calls[0].hookType).toBe(HookName.BEFORE_MEMORY_STORE);
      const data = registry.calls[0].data as {
        content: string;
        agentId: string;
        sessionId: string;
      };
      expect(data.content).toBe('Hello world');
      expect(data.agentId).toBe('agent-1');
      expect(data.sessionId).toBe('sess-1');
    });

    test('skips storage when hook returns null', async () => {
      const msg = makeMessage();
      ctx.hookRegistry = createMockRegistry(null);
      await storeConversation(ctx, msg, decisions);
      expect(memory.storeCalls).toHaveLength(0);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].action).toBe('skip_memory');
      expect(decisions[0].reason).toBe('Memory store skipped by plugin');
    });

    test('skips storage when hook returns undefined', async () => {
      const msg = makeMessage();
      ctx.hookRegistry = createMockRegistry(undefined);
      await storeConversation(ctx, msg, decisions);
      expect(memory.storeCalls).toHaveLength(0);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].reason).toBe('Memory store skipped by plugin');
    });

    test('uses modified content from hook', async () => {
      const msg = makeMessage();
      ctx.hookRegistry = createMockRegistry({
        content: 'modified by plugin',
        metadata: { custom: true },
      });
      await storeConversation(ctx, msg, decisions);
      expect(memory.storeCalls).toHaveLength(1);
      expect(memory.storeCalls[0].content).toBe('modified by plugin');
    });
  });
});
