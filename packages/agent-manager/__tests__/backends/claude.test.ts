import { beforeEach, describe, expect, test } from 'bun:test';
import { AIBackend, BACKEND_CAPABILITIES } from '@autonomy/shared';
import { ClaudeBackend } from '../../src/backends/claude.ts';

describe('ClaudeBackend', () => {
  let backend: ClaudeBackend;

  beforeEach(() => {
    backend = new ClaudeBackend();
  });

  describe('identity', () => {
    test('has name "claude"', () => {
      expect(backend.name).toBe('claude');
      expect(backend.name).toBe(AIBackend.CLAUDE);
    });

    test('exposes capabilities matching BACKEND_CAPABILITIES', () => {
      expect(backend.capabilities).toEqual(BACKEND_CAPABILITIES[AIBackend.CLAUDE]);
    });

    test('capabilities include customTools: true', () => {
      expect(backend.capabilities.customTools).toBe(true);
    });

    test('capabilities include streaming: true', () => {
      expect(backend.capabilities.streaming).toBe(true);
    });

    test('capabilities include sessionPersistence: true', () => {
      expect(backend.capabilities.sessionPersistence).toBe(true);
    });

    test('capabilities include fileAccess: true', () => {
      expect(backend.capabilities.fileAccess).toBe(true);
    });
  });

  describe('spawn()', () => {
    test('returns a BackendProcess', async () => {
      const proc = await backend.spawn({
        agentId: 'test-agent',
        systemPrompt: 'You are a test agent.',
      });

      expect(proc).toBeDefined();
      expect(typeof proc.send).toBe('function');
      expect(typeof proc.stop).toBe('function');
      expect(typeof proc.alive).toBe('boolean');
    });

    test('spawned process starts alive', async () => {
      const proc = await backend.spawn({
        agentId: 'test-agent',
        systemPrompt: 'You are a test agent.',
      });
      expect(proc.alive).toBe(true);
    });

    test('accepts optional tools array', async () => {
      const proc = await backend.spawn({
        agentId: 'test-agent',
        systemPrompt: 'You are a test agent.',
        tools: ['Read', 'Write', 'Bash'],
      });
      expect(proc).toBeDefined();
      expect(proc.alive).toBe(true);
    });

    test('accepts optional cwd', async () => {
      const proc = await backend.spawn({
        agentId: 'test-agent',
        systemPrompt: 'You are a test agent.',
        cwd: '/tmp',
      });
      expect(proc).toBeDefined();
    });
  });

  describe('BackendProcess.send()', () => {
    test('sends a prompt and returns a response string', async () => {
      const proc = await backend.spawn({
        agentId: 'test-agent',
        systemPrompt: 'You are a test agent. Reply with "ok".',
      });

      const response = await proc.send('Hello');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });
  });

  describe('BackendProcess.stop()', () => {
    test('terminates the process', async () => {
      const proc = await backend.spawn({
        agentId: 'test-agent',
        systemPrompt: 'You are a test agent.',
      });

      expect(proc.alive).toBe(true);
      await proc.stop();
      expect(proc.alive).toBe(false);
    });

    test('stop() is idempotent (no error on double stop)', async () => {
      const proc = await backend.spawn({
        agentId: 'test-agent',
        systemPrompt: 'You are a test agent.',
      });

      await proc.stop();
      await proc.stop(); // should not throw
      expect(proc.alive).toBe(false);
    });
  });

  describe('BackendProcess.alive', () => {
    test('reflects process state accurately', async () => {
      const proc = await backend.spawn({
        agentId: 'test-agent',
        systemPrompt: 'You are a test agent.',
      });

      expect(proc.alive).toBe(true);
      await proc.stop();
      expect(proc.alive).toBe(false);
    });
  });
});
