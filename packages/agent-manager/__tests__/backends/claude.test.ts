import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { AIBackend, BACKEND_CAPABILITIES } from '@autonomy/shared';
import { ClaudeBackend } from '../../src/backends/claude.ts';
import type { BackendProcess } from '../../src/backends/types.ts';

/**
 * Check if `claude` CLI is available on PATH.
 * Integration tests that spawn real processes are skipped when it is absent (e.g. CI).
 */
let claudeAvailable = false;
try {
  const proc = Bun.spawnSync(['which', 'claude']);
  claudeAvailable = proc.exitCode === 0;
} catch {
  claudeAvailable = false;
}

const describeIntegration = claudeAvailable ? describe : describe.skip;

/** Timeout (ms) for integration tests that spawn real CLI processes. */
const INTEGRATION_TIMEOUT_MS = 30_000;

describe('ClaudeBackend', () => {
  let backend: ClaudeBackend;
  /** Track spawned processes so afterEach can clean them up. */
  let spawnedProc: BackendProcess | undefined;

  beforeEach(() => {
    backend = new ClaudeBackend();
    spawnedProc = undefined;
  });

  afterEach(async () => {
    if (spawnedProc?.alive) {
      await spawnedProc.stop();
    }
    spawnedProc = undefined;
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

  describeIntegration('spawn()', () => {
    test(
      'returns a BackendProcess',
      async () => {
        spawnedProc = await backend.spawn({
          agentId: 'test-agent',
          systemPrompt: 'You are a test agent.',
          skipPermissions: true,
        });

        expect(spawnedProc).toBeDefined();
        expect(typeof spawnedProc.send).toBe('function');
        expect(typeof spawnedProc.stop).toBe('function');
        expect(typeof spawnedProc.alive).toBe('boolean');
      },
      { timeout: INTEGRATION_TIMEOUT_MS },
    );

    test(
      'spawned process starts alive',
      async () => {
        spawnedProc = await backend.spawn({
          agentId: 'test-agent',
          systemPrompt: 'You are a test agent.',
          skipPermissions: true,
        });
        expect(spawnedProc.alive).toBe(true);
      },
      { timeout: INTEGRATION_TIMEOUT_MS },
    );

    test(
      'accepts optional tools array',
      async () => {
        spawnedProc = await backend.spawn({
          agentId: 'test-agent',
          systemPrompt: 'You are a test agent.',
          tools: ['Read', 'Write', 'Bash'],
          skipPermissions: true,
        });
        expect(spawnedProc).toBeDefined();
        expect(spawnedProc.alive).toBe(true);
      },
      { timeout: INTEGRATION_TIMEOUT_MS },
    );

    test(
      'accepts optional cwd',
      async () => {
        spawnedProc = await backend.spawn({
          agentId: 'test-agent',
          systemPrompt: 'You are a test agent.',
          cwd: '/tmp',
          skipPermissions: true,
        });
        expect(spawnedProc).toBeDefined();
      },
      { timeout: INTEGRATION_TIMEOUT_MS },
    );
  });

  describeIntegration('BackendProcess.send()', () => {
    test(
      'sends a prompt and returns a response string',
      async () => {
        spawnedProc = await backend.spawn({
          agentId: 'test-agent',
          systemPrompt: 'You are a test agent. Reply with "ok".',
          skipPermissions: true,
        });

        const response = await spawnedProc.send('Hello');
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
      },
      { timeout: INTEGRATION_TIMEOUT_MS },
    );
  });

  describeIntegration('BackendProcess.stop()', () => {
    test(
      'terminates the process',
      async () => {
        spawnedProc = await backend.spawn({
          agentId: 'test-agent',
          systemPrompt: 'You are a test agent.',
          skipPermissions: true,
        });

        expect(spawnedProc.alive).toBe(true);
        await spawnedProc.stop();
        expect(spawnedProc.alive).toBe(false);
      },
      { timeout: INTEGRATION_TIMEOUT_MS },
    );

    test(
      'stop() is idempotent (no error on double stop)',
      async () => {
        spawnedProc = await backend.spawn({
          agentId: 'test-agent',
          systemPrompt: 'You are a test agent.',
          skipPermissions: true,
        });

        await spawnedProc.stop();
        await spawnedProc.stop(); // should not throw
        expect(spawnedProc.alive).toBe(false);
      },
      { timeout: INTEGRATION_TIMEOUT_MS },
    );
  });

  describeIntegration('BackendProcess.alive', () => {
    test(
      'reflects process state accurately',
      async () => {
        spawnedProc = await backend.spawn({
          agentId: 'test-agent',
          systemPrompt: 'You are a test agent.',
          skipPermissions: true,
        });

        expect(spawnedProc.alive).toBe(true);
        await spawnedProc.stop();
        expect(spawnedProc.alive).toBe(false);
      },
      { timeout: INTEGRATION_TIMEOUT_MS },
    );
  });
});
