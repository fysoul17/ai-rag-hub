import { beforeEach, describe, expect, test } from 'bun:test';
import type { ConductorDecision, MemoryInterface } from '@autonomy/shared';
import { MemoryType } from '@autonomy/shared';
import { storeConversation } from '../src/conductor-memory.ts';
import { MockMemory } from './helpers/mock-memory.ts';
import { makeMessage } from './helpers/mock-registry.ts';

/**
 * Tests that storeConversation() explicitly targets sqlite-only storage —
 * knowledge graph ingestion is handled by the consolidation pipeline, not
 * the conversation store path. Passing targets: ['sqlite'] prevents
 * vector/graph failures from crashing the store.
 */

describe('storeConversation — graph ingestion gaps', () => {
  let memory: MockMemory;
  let decisions: ConductorDecision[];

  beforeEach(() => {
    memory = new MockMemory();
    decisions = [];
  });

  test('store call explicitly targets sqlite only', async () => {
    const msg = makeMessage({ content: 'Alice works at Acme Corp' });
    await storeConversation(
      memory as unknown as MemoryInterface,
      undefined,
      true,
      msg,
      decisions,
    );

    expect(memory.storeCalls).toHaveLength(1);
    expect(memory.storeCalls[0].targets).toEqual(['sqlite']);
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

  test('assistant response store call also targets sqlite only', async () => {
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
    // User message store targets sqlite only
    expect(memory.storeCalls[0].targets).toEqual(['sqlite']);
    // Assistant response store also targets sqlite only
    expect(memory.storeCalls[1].targets).toEqual(['sqlite']);
  });

  test('store call only contains content, type, agentId, sessionId, metadata, targets', async () => {
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
    expect(call.targets).toEqual(['sqlite']);

    expect(call.entities).toBeUndefined();
    expect(call.relationships).toBeUndefined();
  });

  test('explicit sqlite target means vector/graph failures cannot affect storage', async () => {
    // This test validates the contract: when targets is ['sqlite'],
    // pyx-memory should only attempt sqlite storage, so vector embedding
    // failures or graph DB connection issues cannot cause the store to fail.
    const msg = makeMessage({ content: 'Data that should survive vector failure' });
    await storeConversation(
      memory as unknown as MemoryInterface,
      undefined,
      true,
      msg,
      decisions,
    );

    expect(memory.storeCalls).toHaveLength(1);
    const call = memory.storeCalls[0];

    // targets must be exactly ['sqlite'] — no 'vector' or 'graph'
    expect(call.targets).toEqual(['sqlite']);
    expect(call.targets).not.toContain('vector');
    expect(call.targets).not.toContain('graph');
  });

  test('both user and assistant stores exclude vector and graph targets', async () => {
    const msg = makeMessage({ content: 'User question about architecture' });
    await storeConversation(
      memory as unknown as MemoryInterface,
      undefined,
      true,
      msg,
      decisions,
      'Architecture involves microservices with event sourcing.',
    );

    expect(memory.storeCalls).toHaveLength(2);

    for (const call of memory.storeCalls) {
      expect(call.targets).toBeDefined();
      expect(call.targets).toEqual(['sqlite']);
      expect(call.targets).not.toContain('vector');
      expect(call.targets).not.toContain('graph');
    }
  });
});
