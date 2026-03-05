import { beforeEach, describe, expect, test } from 'bun:test';
import type { ConductorDecision, MemoryInterface } from '@autonomy/shared';
import { MemoryType } from '@autonomy/shared';
import { storeConversation } from '../src/conductor-memory.ts';
import { MockMemory } from './helpers/mock-memory.ts';
import { makeMessage } from './helpers/mock-registry.ts';

/**
 * Tests that storeConversation() uses pyx-memory default targets (sqlite+vector)
 * and never includes graph targets — knowledge graph ingestion is handled by
 * the consolidation pipeline, not the conversation store path.
 */

describe('storeConversation — graph ingestion gaps', () => {
  let memory: MockMemory;
  let decisions: ConductorDecision[];

  beforeEach(() => {
    memory = new MockMemory();
    decisions = [];
  });

  test('store call uses default targets (sqlite+vector via pyx-memory defaults)', async () => {
    const msg = makeMessage({ content: 'Alice works at Acme Corp' });
    await storeConversation(
      memory as unknown as MemoryInterface,
      undefined,
      true,
      msg,
      decisions,
    );

    expect(memory.storeCalls).toHaveLength(1);
    expect(memory.storeCalls[0].targets).toBeUndefined();
  });

  test('store call never includes entities even when content has named entities', async () => {
    const msg = makeMessage({
      content: 'Alice met Bob at the TypeScript conference in Seattle',
    });
    await storeConversation(
      memory as unknown as MemoryInterface,
      undefined,
      true,
      msg,
      decisions,
    );

    expect(memory.storeCalls).toHaveLength(1);
    expect(memory.storeCalls[0].entities).toBeUndefined();
  });

  test('store call never includes relationships', async () => {
    const msg = makeMessage({
      content: 'Alice works at Acme and manages the AI team',
    });
    await storeConversation(
      memory as unknown as MemoryInterface,
      undefined,
      true,
      msg,
      decisions,
    );

    expect(memory.storeCalls).toHaveLength(1);
    expect(memory.storeCalls[0].relationships).toBeUndefined();
  });

  test('assistant response store call also uses default targets', async () => {
    const msg = makeMessage({ content: 'Tell me about the project' });
    await storeConversation(
      memory as unknown as MemoryInterface,
      undefined,
      true,
      msg,
      decisions,
      'The project uses TypeScript and is managed by Alice.',
    );

    expect(memory.storeCalls).toHaveLength(2);
    expect(memory.storeCalls[0].targets).toBeUndefined();
    expect(memory.storeCalls[1].targets).toBeUndefined();
  });

  test('store call only contains content, type, agentId, sessionId, metadata', async () => {
    const msg = makeMessage({
      content: 'Important meeting notes',
      senderId: 'agent-1',
      sessionId: 'sess-1',
      senderName: 'TestBot',
    });
    await storeConversation(
      memory as unknown as MemoryInterface,
      undefined,
      true,
      msg,
      decisions,
    );

    expect(memory.storeCalls).toHaveLength(1);
    const call = memory.storeCalls[0];

    expect(call.content).toBe('Important meeting notes');
    expect(call.type).toBe(MemoryType.SHORT_TERM);
    expect(call.agentId).toBe('agent-1');
    expect(call.sessionId).toBe('sess-1');
    expect(call.metadata).toEqual({ senderName: 'TestBot' });

    expect(call.targets).toBeUndefined();
    expect(call.entities).toBeUndefined();
    expect(call.relationships).toBeUndefined();
  });
});
