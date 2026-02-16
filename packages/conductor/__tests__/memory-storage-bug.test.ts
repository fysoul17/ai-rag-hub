/**
 * Tests: AI-driven memory storage decisions.
 *
 * The Conductor's router (AI or keyword) sets `storeInMemory` on the routing result.
 * When `storeInMemory === false`, the message is skipped. When `undefined` (default)
 * or `true`, the message is stored. This replaces the old hardcoded English word list
 * approach with a language-agnostic, context-aware decision.
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import type { AgentPool } from '@autonomy/agent-manager';
import type { Memory } from '@autonomy/memory';
import { type AgentDefinition, type AgentRuntimeInfo, AgentStatus } from '@autonomy/shared';
import { Conductor } from '../src/conductor.ts';
import type { RouterFn } from '../src/types.ts';
import { makeMessage } from './helpers/fixtures.ts';
import { MockMemory } from './helpers/mock-memory.ts';

function createMockPool() {
  const agents = new Map<string, { definition: AgentDefinition; runtime: AgentRuntimeInfo }>();
  let sendResponse = 'Mock response';

  return {
    setSendResponse(r: string) {
      sendResponse = r;
    },
    create: async (definition: AgentDefinition) => {
      const runtime = {
        id: definition.id,
        name: definition.name,
        role: definition.role,
        status: AgentStatus.IDLE,
        owner: definition.owner,
        persistent: definition.persistent,
        createdAt: definition.createdAt,
      };
      agents.set(definition.id, { definition, runtime });
      return { id: definition.id, definition, toRuntimeInfo: () => runtime };
    },
    get: (id: string) => {
      const entry = agents.get(id);
      if (!entry) return undefined;
      return { definition: entry.definition, toRuntimeInfo: () => entry.runtime };
    },
    list: () => [...agents.values()].map((a) => a.runtime),
    remove: async (id: string) => {
      agents.delete(id);
    },
    sendMessage: async (_id: string, _msg: string) => sendResponse,
    shutdown: async () => {
      agents.clear();
    },
    _agents: agents,
  };
}

/** Creates a router that sets storeInMemory to the given value. */
function makeRouter(storeInMemory?: boolean): RouterFn {
  return async () => ({
    agentIds: [],
    directResponse: true,
    response: 'Test response',
    storeInMemory,
    reason: 'Test router',
  });
}

describe('AI-driven memory storage decisions', () => {
  let conductor: Conductor;
  let pool: ReturnType<typeof createMockPool>;
  let memory: MockMemory;

  beforeEach(async () => {
    pool = createMockPool();
    memory = new MockMemory();
    conductor = new Conductor(pool as unknown as AgentPool, memory as unknown as Memory);
    await conductor.initialize();
  });

  test('storeInMemory: false → message NOT stored', async () => {
    conductor.setRouter(makeRouter(false));
    await conductor.handleMessage(makeMessage({ content: 'Tell me about quantum physics' }));

    expect(memory.storeCalls.length).toBe(0);
  });

  test('storeInMemory: true → message IS stored', async () => {
    conductor.setRouter(makeRouter(true));
    await conductor.handleMessage(makeMessage({ content: 'Tell me about quantum physics' }));

    expect(memory.storeCalls.length).toBe(1);
    expect(memory.storeCalls[0].content).toBe('Tell me about quantum physics');
  });

  test('storeInMemory: undefined (default) → message IS stored (backward compat)', async () => {
    conductor.setRouter(makeRouter(undefined));
    await conductor.handleMessage(makeMessage({ content: 'Tell me about quantum physics' }));

    expect(memory.storeCalls.length).toBe(1);
  });

  test('empty content → NOT stored regardless of storeInMemory', async () => {
    conductor.setRouter(makeRouter(true));
    await conductor.handleMessage(makeMessage({ content: '' }));

    expect(memory.storeCalls.length).toBe(0);
  });

  test('whitespace-only content → NOT stored regardless of storeInMemory', async () => {
    conductor.setRouter(makeRouter(true));
    await conductor.handleMessage(makeMessage({ content: '   ' }));

    expect(memory.storeCalls.length).toBe(0);
  });

  test('skip_memory decision is recorded when storeInMemory is false', async () => {
    conductor.setRouter(makeRouter(false));
    const result = await conductor.handleMessage(makeMessage({ content: 'hi' }));

    const skipDecision = result.decisions.find((d) => d.action === 'skip_memory');
    expect(skipDecision).toBeDefined();
    expect(skipDecision?.reason).toContain('not worth storing');
  });

  test('skip_memory decision is recorded for empty content', async () => {
    conductor.setRouter(makeRouter(true));
    const result = await conductor.handleMessage(makeMessage({ content: '' }));

    const skipDecision = result.decisions.find((d) => d.action === 'skip_memory');
    expect(skipDecision).toBeDefined();
    expect(skipDecision?.reason).toContain('Empty');
  });

  test('store_memory decision is recorded when stored', async () => {
    conductor.setRouter(makeRouter(true));
    const result = await conductor.handleMessage(
      makeMessage({ content: 'Set up a Kubernetes cluster' }),
    );

    const storeDecision = result.decisions.find((d) => d.action === 'store_memory');
    expect(storeDecision).toBeDefined();
  });

  test('mixed scenario: only substantive messages stored', async () => {
    // Simulate AI router marking greetings as not-storable
    let callCount = 0;
    const smartRouter: RouterFn = async () => {
      callCount++;
      // Messages 1-3 are trivial (hi, hey, ok), 4-5 are substantive
      const trivial = callCount <= 3;
      return {
        agentIds: [],
        directResponse: true,
        response: 'Response',
        storeInMemory: !trivial,
        reason: trivial ? 'Trivial greeting' : 'Substantive message',
      };
    };
    conductor.setRouter(smartRouter);

    await conductor.handleMessage(makeMessage({ content: 'hi' }));
    await conductor.handleMessage(makeMessage({ content: 'hey' }));
    await conductor.handleMessage(makeMessage({ content: 'ok' }));
    await conductor.handleMessage(
      makeMessage({ content: 'can you generate an agent for web scraping?' }),
    );
    await conductor.handleMessage(makeMessage({ content: 'what do you have in memory?' }));

    expect(memory.storeCalls.length).toBe(2);
  });
});
