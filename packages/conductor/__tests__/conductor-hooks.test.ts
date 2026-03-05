import { describe, expect, test } from 'bun:test';
import type { ConductorDecision, MemorySearchResult } from '@autonomy/shared';
import { HookName, RAGStrategy } from '@autonomy/shared';
import {
  runAfterMemorySearchHook,
  runAfterResponseHook,
  runBeforeMessageHook,
} from '../src/conductor-hooks.ts';
import { createMockRegistry, makeMessage } from './helpers/mock-registry.ts';

describe('runBeforeMessageHook', () => {
  test('returns the message when hookRegistry is undefined', async () => {
    const msg = makeMessage();
    const result = await runBeforeMessageHook(undefined, msg);
    expect(result).toBe(msg);
  });

  test('calls emitWaterfall with BEFORE_MESSAGE hook', async () => {
    const msg = makeMessage();
    const registry = createMockRegistry({ message: msg });
    await runBeforeMessageHook(registry, msg);
    expect(registry.calls).toHaveLength(1);
    expect(registry.calls[0].hookType).toBe(HookName.BEFORE_MESSAGE);
  });

  test('returns null when hook returns null (message rejected)', async () => {
    const msg = makeMessage();
    const registry = createMockRegistry(null);
    const result = await runBeforeMessageHook(registry, msg);
    expect(result).toBeNull();
  });

  test('returns null when hook returns undefined', async () => {
    const msg = makeMessage();
    const registry = createMockRegistry(undefined);
    const result = await runBeforeMessageHook(registry, msg);
    expect(result).toBeNull();
  });

  test('returns modified message from hook result', async () => {
    const msg = makeMessage();
    const modified = makeMessage({ content: 'modified content' });
    const registry = createMockRegistry({ message: modified });
    const result = await runBeforeMessageHook(registry, msg);
    expect(result).toBe(modified);
  });

  test('returns original message when hook result has no message property', async () => {
    const msg = makeMessage();
    const registry = createMockRegistry({ something: 'else' });
    const result = await runBeforeMessageHook(registry, msg);
    expect(result).toBe(msg);
  });
});

describe('runAfterMemorySearchHook', () => {
  const memoryContext: MemorySearchResult = {
    entries: [
      {
        id: 'e1',
        content: 'test memory',
        type: 'short-term' as MemorySearchResult['entries'][0]['type'],
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ],
    totalCount: 1,
    strategy: RAGStrategy.HYBRID,
  };

  test('returns memoryContext when hookRegistry is undefined', async () => {
    const msg = makeMessage();
    const result = await runAfterMemorySearchHook(undefined, msg, memoryContext);
    expect(result).toBe(memoryContext);
  });

  test('returns null memoryContext when hookRegistry is undefined and context is null', async () => {
    const msg = makeMessage();
    const result = await runAfterMemorySearchHook(undefined, msg, null);
    expect(result).toBeNull();
  });

  test('calls emitWaterfall with AFTER_MEMORY_SEARCH hook', async () => {
    const msg = makeMessage();
    const registry = createMockRegistry({ memoryResult: memoryContext });
    await runAfterMemorySearchHook(registry, msg, memoryContext);
    expect(registry.calls).toHaveLength(1);
    expect(registry.calls[0].hookType).toBe(HookName.AFTER_MEMORY_SEARCH);
  });

  test('returns modified memoryResult from hook', async () => {
    const msg = makeMessage();
    const modified: MemorySearchResult = {
      entries: [],
      totalCount: 0,
      strategy: RAGStrategy.NAIVE,
    };
    const registry = createMockRegistry({ memoryResult: modified });
    const result = await runAfterMemorySearchHook(registry, msg, memoryContext);
    expect(result).toBe(modified);
  });

  test('returns null memoryResult from hook (plugin clears context)', async () => {
    const msg = makeMessage();
    const registry = createMockRegistry({ memoryResult: null });
    const result = await runAfterMemorySearchHook(registry, msg, memoryContext);
    expect(result).toBeNull();
  });

  test('returns original memoryContext when hook result has no memoryResult', async () => {
    const msg = makeMessage();
    const registry = createMockRegistry({ something: 'else' });
    const result = await runAfterMemorySearchHook(registry, msg, memoryContext);
    expect(result).toBe(memoryContext);
  });

  test('returns original memoryContext when hook returns non-object', async () => {
    const msg = makeMessage();
    const registry = createMockRegistry('string-result');
    const result = await runAfterMemorySearchHook(registry, msg, memoryContext);
    expect(result).toBe(memoryContext);
  });
});

describe('runAfterResponseHook', () => {
  const decisions: ConductorDecision[] = [
    { timestamp: new Date().toISOString(), action: 'respond', reason: 'test' },
  ];

  test('returns responseContent when hookRegistry is undefined', async () => {
    const result = await runAfterResponseHook(undefined, 'Hello', 'agent-1', decisions);
    expect(result).toBe('Hello');
  });

  test('calls emitWaterfall with AFTER_RESPONSE hook', async () => {
    const registry = createMockRegistry({
      response: { content: 'Hello', agentId: 'agent-1', decisions },
    });
    await runAfterResponseHook(registry, 'Hello', 'agent-1', decisions);
    expect(registry.calls).toHaveLength(1);
    expect(registry.calls[0].hookType).toBe(HookName.AFTER_RESPONSE);
  });

  test('returns modified content from hook', async () => {
    const registry = createMockRegistry({
      response: { content: 'Modified response', agentId: 'agent-1', decisions },
    });
    const result = await runAfterResponseHook(registry, 'Original', 'agent-1', decisions);
    expect(result).toBe('Modified response');
  });

  test('returns original content when hook result has no response property', async () => {
    const registry = createMockRegistry({ something: 'else' });
    const result = await runAfterResponseHook(registry, 'Original', 'agent-1', decisions);
    expect(result).toBe('Original');
  });

  test('returns original content when hook returns non-object', async () => {
    const registry = createMockRegistry(42);
    const result = await runAfterResponseHook(registry, 'Original', 'agent-1', decisions);
    expect(result).toBe('Original');
  });

  test('passes agentId and decisions to hook', async () => {
    const registry = createMockRegistry({
      response: { content: 'ok', agentId: 'agent-1', decisions },
    });
    await runAfterResponseHook(registry, 'Hello', 'agent-1', decisions);
    const data = registry.calls[0].data as {
      response: { content: string; agentId: string; decisions: ConductorDecision[] };
    };
    expect(data.response.agentId).toBe('agent-1');
    expect(data.response.decisions).toBe(decisions);
  });

  test('handles undefined agentId', async () => {
    const registry = createMockRegistry({
      response: { content: 'ok', agentId: undefined, decisions },
    });
    const result = await runAfterResponseHook(registry, 'Hello', undefined, decisions);
    expect(result).toBe('ok');
  });
});
