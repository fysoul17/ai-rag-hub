import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { BackendProcess, CLIBackend } from '@autonomy/agent-manager';
import { SessionProcessPool } from '../src/session-process-pool.ts';

function createMockProcess(overrides?: Partial<BackendProcess>): BackendProcess {
  return {
    send: mock(async (_msg: string) => 'mock response'),
    stop: mock(async () => {}),
    alive: true,
    nativeSessionId: undefined,
    ...overrides,
  };
}

function createMockBackend(overrides?: Partial<CLIBackend>): CLIBackend {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    name: 'claude' as any,
    capabilities: {
      customTools: false,
      streaming: false,
      sessionPersistence: false,
      fileAccess: false,
    },
    spawn: mock(async () => createMockProcess()),
    getConfigOptions: () => [],
    ...overrides,
  };
}

describe('SessionProcessPool', () => {
  let backend: ReturnType<typeof createMockBackend>;
  let pool: SessionProcessPool;

  beforeEach(() => {
    backend = createMockBackend();
    pool = new SessionProcessPool(backend, 'Test system prompt', 100);
  });

  describe('getProcess()', () => {
    test('returns undefined for unknown sessionId', () => {
      const result = pool.getProcess('unknown-session');
      expect(result).toBeUndefined();
    });

    test('returns the process after getOrCreate()', async () => {
      const proc = await pool.getOrCreate('session-1');
      expect(proc).toBeDefined();

      const retrieved = pool.getProcess('session-1');
      expect(retrieved).toBeDefined();
      expect(retrieved).toBe(proc);
    });

    test('returns undefined when the process is dead (alive = false)', async () => {
      const deadProcess = createMockProcess({ alive: false });
      const deadBackend = createMockBackend({
        spawn: mock(async () => deadProcess),
      });
      const deadPool = new SessionProcessPool(deadBackend, 'Test', 100);

      await deadPool.getOrCreate('session-dead');
      // The process was inserted but is not alive
      const result = deadPool.getProcess('session-dead');
      expect(result).toBeUndefined();
    });
  });

  describe('getOrCreate() spawn failure', () => {
    test('returns undefined when backend.spawn throws', async () => {
      const failBackend = createMockBackend({
        spawn: mock(async () => {
          throw new Error('spawn crashed');
        }),
      });
      const failPool = new SessionProcessPool(failBackend, 'Test', 100);
      const result = await failPool.getOrCreate('session-fail');
      expect(result).toBeUndefined();
    });

    test('returns undefined when no backend is configured', async () => {
      const noBackendPool = new SessionProcessPool(undefined, 'Test', 100);
      const result = await noBackendPool.getOrCreate('session-x');
      expect(result).toBeUndefined();
    });
  });

  describe('LRU eviction', () => {
    test('evicts oldest session when pool is at capacity', async () => {
      const processes: BackendProcess[] = [];
      const evictBackend = createMockBackend({
        spawn: mock(async () => {
          const proc = createMockProcess();
          processes.push(proc);
          return proc;
        }),
      });
      const smallPool = new SessionProcessPool(evictBackend, 'Test', 2);

      await smallPool.getOrCreate('session-a');
      await smallPool.getOrCreate('session-b');
      await smallPool.getOrCreate('session-c');

      // Oldest (session-a) should be evicted and stopped
      expect(processes[0].stop).toHaveBeenCalledTimes(1);
      // session-c should exist
      expect(smallPool.getProcess('session-c')).toBeDefined();
      // session-a should be gone
      expect(smallPool.getProcess('session-a')).toBeUndefined();
    });
  });

  describe('config change invalidation', () => {
    test('respawns process when configOverrides change', async () => {
      const procs: BackendProcess[] = [];
      const trackBackend = createMockBackend({
        spawn: mock(async () => {
          const proc = createMockProcess();
          procs.push(proc);
          return proc;
        }),
      });
      const cfgPool = new SessionProcessPool(trackBackend, 'Test', 100);

      await cfgPool.getOrCreate('sess-1', { model: 'claude-3' });
      await cfgPool.getOrCreate('sess-1', { model: 'claude-4' });

      // First process should have been stopped due to config change
      expect(procs[0].stop).toHaveBeenCalledTimes(1);
      // Two spawns total
      expect(trackBackend.spawn).toHaveBeenCalledTimes(2);
    });

    test('does not respawn when configOverrides are identical', async () => {
      await pool.getOrCreate('sess-1', { model: 'claude-3' });
      await pool.getOrCreate('sess-1', { model: 'claude-3' });

      // Only one spawn — config didn't change
      expect(backend.spawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidate()', () => {
    test('stops and removes the session process', async () => {
      const proc = createMockProcess();
      const trackBackend = createMockBackend({
        spawn: mock(async () => proc),
      });
      const invPool = new SessionProcessPool(trackBackend, 'Test', 100);

      await invPool.getOrCreate('sess-inv');
      expect(invPool.getProcess('sess-inv')).toBeDefined();

      invPool.invalidate('sess-inv');
      expect(proc.stop).toHaveBeenCalledTimes(1);
      expect(invPool.getProcess('sess-inv')).toBeUndefined();
    });

    test('is a no-op for unknown session', () => {
      // Should not throw
      pool.invalidate('nonexistent');
    });
  });

  describe('shutdown()', () => {
    test('stops all processes and clears state', async () => {
      const procs: BackendProcess[] = [];
      const shutBackend = createMockBackend({
        spawn: mock(async () => {
          const proc = createMockProcess();
          procs.push(proc);
          return proc;
        }),
      });
      const shutPool = new SessionProcessPool(shutBackend, 'Test', 100);

      await shutPool.getOrCreate('s1');
      await shutPool.getOrCreate('s2');
      await shutPool.getOrCreate('s3');

      await shutPool.shutdown();

      for (const proc of procs) {
        expect(proc.stop).toHaveBeenCalledTimes(1);
      }
      expect(shutPool.getProcess('s1')).toBeUndefined();
      expect(shutPool.getProcess('s2')).toBeUndefined();
      expect(shutPool.getProcess('s3')).toBeUndefined();
    });
  });

  describe('getOrCreate() with backendSessionId', () => {
    test('passes sessionId to spawn config when backendSessionId is provided', async () => {
      await pool.getOrCreate('session-resume', undefined, 'native-sess-456');

      expect(backend.spawn).toHaveBeenCalledTimes(1);
      const spawnCall = (backend.spawn as ReturnType<typeof mock>).mock.calls[0] as [
        Record<string, unknown>,
      ];
      const config = spawnCall[0];
      expect(config.sessionId).toBe('native-sess-456');
    });

    test('does not include sessionId in spawn config when backendSessionId is omitted', async () => {
      await pool.getOrCreate('session-fresh');

      expect(backend.spawn).toHaveBeenCalledTimes(1);
      const spawnCall = (backend.spawn as ReturnType<typeof mock>).mock.calls[0] as [
        Record<string, unknown>,
      ];
      const config = spawnCall[0];
      expect(config.sessionId).toBeUndefined();
    });

    test('returns existing alive process without re-spawning', async () => {
      await pool.getOrCreate('session-reuse');
      await pool.getOrCreate('session-reuse');

      // Only spawned once since process is alive
      expect(backend.spawn).toHaveBeenCalledTimes(1);
    });
  });
});
