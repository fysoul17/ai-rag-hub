import { beforeEach, describe, expect, test } from 'bun:test';
import { type AgentDefinition, AgentStatus } from '@autonomy/shared';
import { AgentProcess } from '../src/agent-process.ts';
import { MockBackend } from './helpers/mock-backend.ts';

/** Helper to build a minimal valid AgentDefinition for tests. */
function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    role: 'tester',
    tools: [],
    canModifyFiles: false,
    canDelegateToAgents: false,
    maxConcurrent: 1,
    owner: 'user',
    persistent: false,
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    systemPrompt: 'You are a test agent.',
    ...overrides,
  };
}

describe('AgentProcess', () => {
  let backend: MockBackend;
  let definition: AgentDefinition;

  beforeEach(() => {
    backend = new MockBackend();
    backend.setResponses(['test response']);
    definition = makeAgent();
  });

  describe('constructor', () => {
    test('accepts AgentDefinition and CLIBackend', () => {
      const agent = new AgentProcess(definition, backend);
      expect(agent).toBeDefined();
    });

    test('initial status is STOPPED before start()', () => {
      const agent = new AgentProcess(definition, backend);
      expect(agent.status).toBe(AgentStatus.STOPPED);
    });

    test('exposes the agent definition', () => {
      const agent = new AgentProcess(definition, backend);
      expect(agent.definition).toEqual(definition);
    });
  });

  describe('start()', () => {
    test('spawns the backend process', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      expect(backend.spawnCalls).toHaveLength(1);
      expect(backend.spawnCalls[0].agentId).toBe('agent-1');
    });

    test('transitions status to IDLE after start', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      expect(agent.status).toBe(AgentStatus.IDLE);
    });

    test('passes systemPrompt to backend spawn config', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      expect(backend.spawnCalls[0].systemPrompt).toBe('You are a test agent.');
    });

    test('passes tools to backend spawn config', async () => {
      const def = makeAgent({ tools: ['Read', 'Grep'] });
      const agent = new AgentProcess(def, backend);
      await agent.start();
      expect(backend.spawnCalls[0].tools).toEqual(['Read', 'Grep']);
    });

    test('throws if already started', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      await expect(agent.start()).rejects.toThrow();
    });

    test('sets status to ERROR if backend spawn fails', async () => {
      backend.spawnError = new Error('spawn failure');
      const agent = new AgentProcess(definition, backend);
      await expect(agent.start()).rejects.toThrow('spawn failure');
      expect(agent.status).toBe(AgentStatus.ERROR);
    });
  });

  describe('sendMessage()', () => {
    test('returns backend response as string', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      const response = await agent.sendMessage('hello');
      expect(response).toBe('test response');
    });

    test('delegates message to backend process', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      await agent.sendMessage('hello');
      const proc = backend.spawnedProcesses[0];
      expect(proc.sentMessages).toContain('hello');
    });

    test('status is BUSY while processing, IDLE after', async () => {
      backend.sendDelayMs = 50;
      const agent = new AgentProcess(definition, backend);
      await agent.start();

      const sendPromise = agent.sendMessage('hello');

      // Give the message time to start processing
      await new Promise((r) => setTimeout(r, 10));
      expect(agent.status).toBe(AgentStatus.BUSY);

      await sendPromise;
      expect(agent.status).toBe(AgentStatus.IDLE);
    });

    test('throws when agent is STOPPED', async () => {
      const agent = new AgentProcess(definition, backend);
      // never started — status is STOPPED
      await expect(agent.sendMessage('hello')).rejects.toThrow();
    });

    test('throws when agent has been stopped', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      await agent.stop();
      await expect(agent.sendMessage('hello')).rejects.toThrow();
    });

    test('sets status to ERROR when backend send fails', async () => {
      backend.processErrorToThrow = new Error('send failure');
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      // Clear the error set during spawn (the mock sets it on spawn)
      // The processErrorToThrow is set before spawn, so we need a different approach
      const proc = backend.spawnedProcesses[0];
      proc.errorToThrow = new Error('send failure');

      await expect(agent.sendMessage('hello')).rejects.toThrow('send failure');
      expect(agent.status).toBe(AgentStatus.ERROR);
    });

    test('queues concurrent messages (serial execution)', async () => {
      backend.sendDelayMs = 30;
      backend.setResponses(['first', 'second', 'third']);
      const agent = new AgentProcess(definition, backend);
      await agent.start();

      // Send three messages concurrently
      const p1 = agent.sendMessage('msg1');
      const p2 = agent.sendMessage('msg2');
      const p3 = agent.sendMessage('msg3');

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      expect(r1).toBe('first');
      expect(r2).toBe('second');
      expect(r3).toBe('third');

      // Verify all messages were sent to the backend process
      const proc = backend.spawnedProcesses[0];
      expect(proc.sentMessages).toEqual(['msg1', 'msg2', 'msg3']);
    });
  });

  describe('stop()', () => {
    test('transitions status to STOPPED', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      await agent.stop();
      expect(agent.status).toBe(AgentStatus.STOPPED);
    });

    test('stops the backend process', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      await agent.stop();
      const proc = backend.spawnedProcesses[0];
      expect(proc.alive).toBe(false);
    });

    test('is idempotent (no error on double stop)', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      await agent.stop();
      await agent.stop(); // should not throw
      expect(agent.status).toBe(AgentStatus.STOPPED);
    });
  });

  describe('restart()', () => {
    test('stops and then starts the agent', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      expect(backend.spawnCalls).toHaveLength(1);

      await agent.restart();
      expect(agent.status).toBe(AgentStatus.IDLE);
      // Should have spawned a second time
      expect(backend.spawnCalls).toHaveLength(2);
    });

    test('old backend process is stopped after restart', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      const firstProc = backend.spawnedProcesses[0];

      await agent.restart();
      expect(firstProc.alive).toBe(false);
    });

    test('agent is functional after restart', async () => {
      backend.setResponses(['after restart']);
      const agent = new AgentProcess(definition, backend);
      await agent.start();
      await agent.restart();

      const response = await agent.sendMessage('ping');
      expect(typeof response).toBe('string');
    });
  });

  describe('idle timeout', () => {
    test('auto-stops after configured idle duration', async () => {
      // Use a very short timeout for testing
      const def = makeAgent({ id: 'idle-agent' });
      const agent = new AgentProcess(def, backend, { idleTimeoutMs: 50 });
      await agent.start();
      expect(agent.status).toBe(AgentStatus.IDLE);

      // Wait for timeout to expire
      await new Promise((r) => setTimeout(r, 100));
      expect(agent.status).toBe(AgentStatus.STOPPED);
    });

    test('resets idle timer on message', async () => {
      const def = makeAgent({ id: 'idle-agent' });
      const agent = new AgentProcess(def, backend, { idleTimeoutMs: 80 });
      await agent.start();

      // Send a message before timeout
      await new Promise((r) => setTimeout(r, 40));
      await agent.sendMessage('keep alive');

      // Should still be alive shortly after message
      await new Promise((r) => setTimeout(r, 40));
      expect(agent.status).toBe(AgentStatus.IDLE);

      // Wait for full idle timeout to elapse after last message
      await new Promise((r) => setTimeout(r, 80));
      expect(agent.status).toBe(AgentStatus.STOPPED);
    });

    test('does not auto-stop when idleTimeoutMs is 0 (disabled)', async () => {
      const def = makeAgent({ id: 'no-timeout' });
      const agent = new AgentProcess(def, backend, { idleTimeoutMs: 0 });
      await agent.start();

      await new Promise((r) => setTimeout(r, 60));
      expect(agent.status).toBe(AgentStatus.IDLE);

      // Clean up
      await agent.stop();
    });
  });

  describe('error handling', () => {
    test('sets status to ERROR on backend process failure during send', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();

      // Manually set error on the spawned process
      const proc = backend.spawnedProcesses[0];
      proc.errorToThrow = new Error('runtime error');

      await expect(agent.sendMessage('hello')).rejects.toThrow('runtime error');
      expect(agent.status).toBe(AgentStatus.ERROR);
    });

    test('can be restarted from ERROR state', async () => {
      const agent = new AgentProcess(definition, backend);
      await agent.start();

      const proc = backend.spawnedProcesses[0];
      proc.errorToThrow = new Error('crash');
      await expect(agent.sendMessage('hello')).rejects.toThrow('crash');
      expect(agent.status).toBe(AgentStatus.ERROR);

      await agent.restart();
      expect(agent.status).toBe(AgentStatus.IDLE);
    });
  });
});
