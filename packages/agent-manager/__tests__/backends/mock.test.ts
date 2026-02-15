import { beforeEach, describe, expect, test } from 'bun:test';
import { AIBackend } from '@autonomy/shared';
import { MockBackend, MockBackendProcess } from '../helpers/mock-backend.ts';

describe('MockBackend test infrastructure', () => {
  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend();
  });

  describe('MockBackend', () => {
    test('implements CLIBackend with default claude identity', () => {
      expect(backend.name).toBe(AIBackend.CLAUDE);
      expect(backend.capabilities).toBeDefined();
      expect(backend.capabilities.customTools).toBe(true);
    });

    test('accepts custom name and capabilities', () => {
      const custom = new MockBackend('codex' as typeof AIBackend.CODEX, {
        customTools: false,
        streaming: true,
        sessionPersistence: false,
        fileAccess: true,
      });
      expect(custom.name).toBe(AIBackend.CODEX);
      expect(custom.capabilities.customTools).toBe(false);
    });

    test('spawn() returns a BackendProcess', async () => {
      const proc = await backend.spawn({
        agentId: 'test-1',
        systemPrompt: 'You are a test agent',
      });
      expect(proc).toBeDefined();
      expect(proc.alive).toBe(true);
    });

    test('spawn() records call configs', async () => {
      const config = {
        agentId: 'test-1',
        systemPrompt: 'prompt',
        tools: ['Read'],
      };
      await backend.spawn(config);
      expect(backend.spawnCalls).toHaveLength(1);
      expect(backend.spawnCalls[0]).toEqual(config);
    });

    test('spawn() tracks created processes', async () => {
      await backend.spawn({ agentId: 'a', systemPrompt: 'p' });
      await backend.spawn({ agentId: 'b', systemPrompt: 'p' });
      expect(backend.spawnedProcesses).toHaveLength(2);
    });

    test('spawn() rejects when spawnError is set', async () => {
      backend.spawnError = new Error('spawn failed');
      await expect(backend.spawn({ agentId: 'x', systemPrompt: 'p' })).rejects.toThrow(
        'spawn failed',
      );
    });

    test('setResponses() changes responses for new processes', async () => {
      backend.setResponses(['alpha', 'beta']);
      const proc = await backend.spawn({ agentId: 'a', systemPrompt: 'p' });
      const r1 = await proc.send('msg1');
      const r2 = await proc.send('msg2');
      expect(r1).toBe('alpha');
      expect(r2).toBe('beta');
    });

    test('sendDelayMs propagates to spawned processes', async () => {
      backend.sendDelayMs = 10;
      const proc = await backend.spawn({ agentId: 'a', systemPrompt: 'p' });
      const start = Date.now();
      await proc.send('msg');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(8); // allow tiny timing variance
    });

    test('processErrorToThrow propagates to spawned processes', async () => {
      backend.processErrorToThrow = new Error('process error');
      const proc = await backend.spawn({ agentId: 'a', systemPrompt: 'p' });
      await expect(proc.send('msg')).rejects.toThrow('process error');
    });
  });

  describe('MockBackendProcess', () => {
    test('starts alive', () => {
      const proc = new MockBackendProcess();
      expect(proc.alive).toBe(true);
    });

    test('send() returns configured responses in order', async () => {
      const proc = new MockBackendProcess(['r1', 'r2', 'r3']);
      expect(await proc.send('a')).toBe('r1');
      expect(await proc.send('b')).toBe('r2');
      expect(await proc.send('c')).toBe('r3');
    });

    test('send() cycles responses when exhausted', async () => {
      const proc = new MockBackendProcess(['only']);
      expect(await proc.send('1')).toBe('only');
      expect(await proc.send('2')).toBe('only');
    });

    test('send() records all sent messages', async () => {
      const proc = new MockBackendProcess();
      await proc.send('hello');
      await proc.send('world');
      expect(proc.sentMessages).toEqual(['hello', 'world']);
    });

    test('send() throws when errorToThrow is set', async () => {
      const proc = new MockBackendProcess();
      proc.errorToThrow = new Error('boom');
      await expect(proc.send('msg')).rejects.toThrow('boom');
    });

    test('send() throws after stop()', async () => {
      const proc = new MockBackendProcess();
      await proc.stop();
      expect(proc.alive).toBe(false);
      await expect(proc.send('msg')).rejects.toThrow('not alive');
    });

    test('stop() sets alive to false', async () => {
      const proc = new MockBackendProcess();
      expect(proc.alive).toBe(true);
      await proc.stop();
      expect(proc.alive).toBe(false);
    });
  });
});
