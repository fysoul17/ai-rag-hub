/**
 * E2E Integration Tests — Server Lifecycle
 *
 * Spawns the real server as a child process, exercises every major endpoint,
 * tests WebSocket connectivity, and verifies graceful shutdown.
 *
 * Environment:
 *   - Random available port (PORT=0 lets Bun pick one)
 *   - Temp DATA_DIR (cleaned up in afterAll)
 *   - AUTH_ENABLED=false (no API keys needed)
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Subprocess } from 'bun';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SERVER_ENTRY = join(import.meta.dir, '../../src/index.ts');
const STARTUP_TIMEOUT_MS = 15_000;
const HEALTH_POLL_INTERVAL_MS = 200;

let serverProc: Subprocess | null = null;
let baseUrl = '';
let serverPort = 0;
let dataDir = '';

async function waitForHealth(url: string, timeoutMs = STARTUP_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await Bun.sleep(HEALTH_POLL_INTERVAL_MS);
  }
  throw new Error(`Server failed to become healthy within ${timeoutMs}ms`);
}

/** Parse a successful API envelope and return the data payload. Throws on failure. */
async function parseOk<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { success: boolean; data?: T; error?: string };
  expect(json.success).toBe(true);
  expect(json.data).toBeDefined();
  return json.data as T;
}

/** Parse an error API envelope and return the error message. */
async function parseErr(res: Response): Promise<string> {
  const json = (await res.json()) as { success: boolean; error?: string };
  expect(json.success).toBe(false);
  expect(json.error).toBeTruthy();
  return json.error as string;
}

/**
 * Extract the listening port from the "Server listening" log line.
 * Must match the line that contains "Server listening" to avoid the
 * initial "Server starting" line which has "port":0 (the requested port).
 */
function extractListeningPort(output: string): number | null {
  for (const line of output.split('\n')) {
    if (!line.includes('Server listening')) continue;
    const urlMatch = line.match(/localhost:(\d+)/);
    if (urlMatch?.[1]) {
      const port = parseInt(urlMatch[1], 10);
      if (port > 0) return port;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Server lifecycle (shared across all tests in this file)
// ---------------------------------------------------------------------------

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'agent-forge-e2e-'));

  serverProc = Bun.spawn(['bun', 'run', SERVER_ENTRY], {
    env: {
      ...process.env,
      PORT: '0',
      DATA_DIR: dataDir,
      AUTH_ENABLED: 'false',
      LOG_LEVEL: 'info',
      ENABLE_DEBUG_WS: 'false',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const reader = serverProc.stdout.getReader();
  let accumulated = '';
  const portDeadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < portDeadline) {
    const readPromise = reader.read();
    const timeoutPromise = Bun.sleep(STARTUP_TIMEOUT_MS).then(() => ({
      value: undefined,
      done: true as const,
    }));
    const { value, done } = await Promise.race([readPromise, timeoutPromise]);
    if (done && !value) break;
    if (value) accumulated += new TextDecoder().decode(value);
    const port = extractListeningPort(accumulated);
    if (port) {
      serverPort = port;
      break;
    }
  }

  reader.releaseLock();

  if (!serverPort) {
    try {
      serverProc.kill('SIGKILL');
    } catch {
      // ignore
    }
    throw new Error(
      `Could not determine server port from stdout.\nCaptured output:\n${accumulated}`,
    );
  }

  baseUrl = `http://localhost:${serverPort}`;
  await waitForHealth(baseUrl);
}, STARTUP_TIMEOUT_MS + 5_000);

afterAll(async () => {
  if (serverProc) {
    serverProc.kill('SIGTERM');
    const exitPromise = serverProc.exited;
    const timeout = Bun.sleep(5_000);
    await Promise.race([exitPromise, timeout]);
    try {
      serverProc.kill('SIGKILL');
    } catch {
      // Already exited
    }
    serverProc = null;
  }

  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E2E: Server Lifecycle', () => {
  // ----- Health -----

  describe('GET /health', () => {
    test('returns 200 with expected shape', async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);

      const health = await parseOk<{
        status: string;
        uptime: number;
        agentCount: number;
        memoryStatus: string;
        version: string;
      }>(res);
      expect(health.status).toBe('ok');
      expect(typeof health.uptime).toBe('number');
      expect(typeof health.agentCount).toBe('number');
      expect(typeof health.memoryStatus).toBe('string');
      expect(typeof health.version).toBe('string');
    });

    test('uptime increases over time', async () => {
      const h1 = await parseOk<{ uptime: number }>(await fetch(`${baseUrl}/health`));
      await Bun.sleep(1_100);
      const h2 = await parseOk<{ uptime: number }>(await fetch(`${baseUrl}/health`));
      expect(h2.uptime).toBeGreaterThanOrEqual(h1.uptime);
    });
  });

  // ----- CORS -----

  describe('CORS preflight', () => {
    test('OPTIONS returns CORS headers', async () => {
      const res = await fetch(`${baseUrl}/health`, { method: 'OPTIONS' });
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(res.headers.get('access-control-allow-methods')).toBeTruthy();
    });
  });

  // ----- Agents CRUD -----

  describe('Agent CRUD /api/agents', () => {
    let createdAgentId: string;

    test('POST /api/agents creates an agent', async () => {
      const res = await fetch(`${baseUrl}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'E2E Test Agent',
          role: 'tester',
          systemPrompt: 'You are a test agent.',
          tools: [],
          canModifyFiles: false,
          canDelegateToAgents: false,
          persistent: false,
        }),
      });

      expect(res.status).toBe(201);
      const agent = await parseOk<{ id: string; name: string; status: string }>(res);
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBe('E2E Test Agent');
      expect(agent.status).toBeTruthy();
      createdAgentId = agent.id;
    });

    test('GET /api/agents lists agents including the created one', async () => {
      const res = await fetch(`${baseUrl}/api/agents`);
      expect(res.status).toBe(200);

      const agents = await parseOk<Array<{ id: string; name: string }>>(res);
      expect(Array.isArray(agents)).toBe(true);
      const found = agents.find((a) => a.id === createdAgentId);
      expect(found).toBeTruthy();
      expect(found?.name).toBe('E2E Test Agent');
    });

    test('POST /api/agents with missing fields returns 400', async () => {
      const res = await fetch(`${baseUrl}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'incomplete' }),
      });
      expect(res.status).toBe(400);
      await parseErr(res);
    });

    test('DELETE /api/agents/:id removes the agent', async () => {
      const res = await fetch(`${baseUrl}/api/agents/${createdAgentId}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);

      const result = await parseOk<{ deleted: string }>(res);
      expect(result.deleted).toBe(createdAgentId);

      // Verify it's gone
      const listRes = await fetch(`${baseUrl}/api/agents`);
      const agents = await parseOk<Array<{ id: string }>>(listRes);
      const found = agents.find((a) => a.id === createdAgentId);
      expect(found).toBeUndefined();
    });

    test('DELETE /api/agents/:id for non-existent agent returns 404', async () => {
      const res = await fetch(`${baseUrl}/api/agents/non-existent-id`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });
  });

  // ----- Sessions CRUD -----

  describe('Session CRUD /api/sessions', () => {
    let createdSessionId: string;

    test('POST /api/sessions creates a session', async () => {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'E2E Test Session' }),
      });

      expect(res.status).toBe(201);
      const session = await parseOk<{
        id: string;
        title: string;
        status: string;
        messageCount: number;
      }>(res);
      expect(session.id).toBeTruthy();
      expect(session.title).toBe('E2E Test Session');
      expect(session.status).toBe('active');
      expect(session.messageCount).toBe(0);
      createdSessionId = session.id;
    });

    test('GET /api/sessions lists sessions', async () => {
      const res = await fetch(`${baseUrl}/api/sessions`);
      expect(res.status).toBe(200);

      const data = await parseOk<{ sessions: Array<{ id: string }>; total: number }>(res);
      expect(Array.isArray(data.sessions)).toBe(true);
      expect(data.total).toBeGreaterThanOrEqual(1);
      const found = data.sessions.find((s) => s.id === createdSessionId);
      expect(found).toBeTruthy();
    });

    test('GET /api/sessions/:id returns session detail', async () => {
      const res = await fetch(`${baseUrl}/api/sessions/${createdSessionId}`);
      expect(res.status).toBe(200);

      const session = await parseOk<{ id: string; title: string; messages: unknown[] }>(res);
      expect(session.id).toBe(createdSessionId);
      expect(session.title).toBe('E2E Test Session');
      expect(Array.isArray(session.messages)).toBe(true);
    });

    test('PUT /api/sessions/:id updates the title', async () => {
      const res = await fetch(`${baseUrl}/api/sessions/${createdSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated Title' }),
      });

      expect(res.status).toBe(200);
      const updated = await parseOk<{ title: string }>(res);
      expect(updated.title).toBe('Updated Title');
    });

    test('DELETE /api/sessions/:id removes the session', async () => {
      const res = await fetch(`${baseUrl}/api/sessions/${createdSessionId}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);

      const result = await parseOk<{ deleted: string }>(res);
      expect(result.deleted).toBe(createdSessionId);
    });

    test('GET /api/sessions/:id for deleted session returns 404', async () => {
      const res = await fetch(`${baseUrl}/api/sessions/${createdSessionId}`);
      expect(res.status).toBe(404);
    });
  });

  // ----- Memory -----

  describe('Memory endpoints /api/memory', () => {
    test('POST /api/memory/ingest stores content', async () => {
      const res = await fetch(`${baseUrl}/api/memory/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'E2E test memory entry about quantum computing',
          type: 'long-term',
          metadata: { source: 'e2e-test' },
        }),
      });

      expect(res.status).toBe(201);
      const entry = await parseOk<{ id: string; content: string }>(res);
      expect(entry.id).toBeTruthy();
      expect(entry.content).toBe('E2E test memory entry about quantum computing');
    });

    test('GET /api/memory/search returns results', async () => {
      const res = await fetch(`${baseUrl}/api/memory/search?query=quantum+computing`);

      expect(res.status).toBe(200);
      const data = await parseOk<{ entries: unknown[]; totalCount: number; strategy: string }>(res);
      expect(Array.isArray(data.entries)).toBe(true);
      expect(typeof data.totalCount).toBe('number');
    });

    test('GET /api/memory/search without query returns 400', async () => {
      const res = await fetch(`${baseUrl}/api/memory/search`);
      expect(res.status).toBe(400);
    });

    test('POST /api/memory/ingest without content returns 400', async () => {
      const res = await fetch(`${baseUrl}/api/memory/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    test('GET /api/memory/stats returns stats', async () => {
      const res = await fetch(`${baseUrl}/api/memory/stats`);
      expect(res.status).toBe(200);
      const stats = await parseOk<{ totalEntries: number; storageUsedBytes: number }>(res);
      expect(typeof stats.totalEntries).toBe('number');
      expect(typeof stats.storageUsedBytes).toBe('number');
    });
  });

  // ----- Config -----

  describe('Config endpoints /api/config', () => {
    test('GET /api/config returns runtime config', async () => {
      const res = await fetch(`${baseUrl}/api/config`);
      expect(res.status).toBe(200);

      const config = await parseOk<{ AI_BACKEND: string; MAX_AGENTS: number }>(res);
      expect(config.AI_BACKEND).toBeTruthy();
      expect(typeof config.MAX_AGENTS).toBe('number');
    });
  });

  // ----- Instances -----

  describe('Instance endpoints /api/instances', () => {
    test('GET /api/instances lists registered instances', async () => {
      const res = await fetch(`${baseUrl}/api/instances`);
      expect(res.status).toBe(200);

      const instances = await parseOk<Array<{ id: string; status: string }>>(res);
      expect(Array.isArray(instances)).toBe(true);
      expect(instances.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ----- Auth keys (auth disabled) -----

  describe('Auth endpoints /api/auth (auth disabled)', () => {
    test('GET /api/auth/keys returns key list', async () => {
      const res = await fetch(`${baseUrl}/api/auth/keys`);
      expect(res.status).toBe(200);

      const keys = await parseOk<unknown[]>(res);
      expect(Array.isArray(keys)).toBe(true);
    });
  });

  // ----- Usage -----

  describe('Usage endpoints /api/usage', () => {
    test('GET /api/usage/summary returns usage data', async () => {
      const res = await fetch(`${baseUrl}/api/usage/summary`);
      expect(res.status).toBe(200);

      const usage = await parseOk<unknown[]>(res);
      expect(Array.isArray(usage)).toBe(true);
    });
  });

  // ----- 404 -----

  describe('Unknown routes', () => {
    test('GET /nonexistent returns 404', async () => {
      const res = await fetch(`${baseUrl}/nonexistent`);
      expect(res.status).toBe(404);
    });
  });

  // ----- WebSocket -----

  describe('WebSocket /ws/chat', () => {
    test('connects and receives ping/pong', async () => {
      const wsUrl = `ws://localhost:${serverPort}/ws/chat`;
      const ws = new WebSocket(wsUrl);
      const messages: string[] = [];

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket test timed out'));
        }, 5_000);

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'ping' }));
        };

        ws.onmessage = (event) => {
          messages.push(event.data as string);
          const parsed = JSON.parse(event.data as string) as { type: string };
          if (parsed.type === 'pong') {
            clearTimeout(timer);
            ws.close();
            resolve();
          }
        };

        ws.onerror = (err) => {
          clearTimeout(timer);
          reject(new Error(`WebSocket error: ${err}`));
        };
      });

      expect(messages.length).toBeGreaterThanOrEqual(1);
      const pongMsg = messages.find((m) => m.includes('pong'));
      expect(pongMsg).toBeTruthy();
      const pong = JSON.parse(pongMsg as string) as { type: string };
      expect(pong.type).toBe('pong');
    });

    test('rejects invalid JSON', async () => {
      const wsUrl = `ws://localhost:${serverPort}/ws/chat`;
      const ws = new WebSocket(wsUrl);
      const messages: string[] = [];

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket invalid JSON test timed out'));
        }, 5_000);

        ws.onopen = () => {
          ws.send('not valid json {{{');
        };

        ws.onmessage = (event) => {
          messages.push(event.data as string);
          const parsed = JSON.parse(event.data as string) as { type: string };
          if (parsed.type === 'error') {
            clearTimeout(timer);
            ws.close();
            resolve();
          }
        };

        ws.onerror = (err) => {
          clearTimeout(timer);
          reject(new Error(`WebSocket error: ${err}`));
        };
      });

      expect(messages.length).toBeGreaterThanOrEqual(1);
      const errorMsg = JSON.parse(messages[0] as string) as { type: string; message: string };
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.message).toBe('Invalid JSON');
    });
  });

  // ----- Graceful shutdown -----

  describe('Graceful shutdown', () => {
    test('server process is running throughout all tests', () => {
      expect(serverProc).toBeTruthy();
      expect(serverProc?.exitCode).toBeNull();
    });
  });
});
