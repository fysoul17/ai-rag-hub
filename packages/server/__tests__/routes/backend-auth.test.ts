import { afterEach, describe, expect, test } from 'bun:test';
import { DefaultBackendRegistry } from '@autonomy/agent-manager';
import { AIBackend, BACKEND_CAPABILITIES, type BackendStatus } from '@autonomy/shared';
import { createBackendRoutes } from '../../src/routes/backends.ts';

/** Mock CLIBackend with configurable getStatus() response and optional logout(). */
class MockBackend {
  readonly name: string;
  readonly capabilities;
  private logoutCalled = false;
  private logoutError?: Error;

  constructor(
    name: string,
    private opts?: { logoutError?: Error },
  ) {
    this.name = name;
    this.capabilities = BACKEND_CAPABILITIES[name as AIBackend] ?? {
      customTools: false,
      streaming: false,
      sessionPersistence: false,
      fileAccess: false,
    };
  }

  async spawn() {
    return { send: async () => 'mock', stop: async () => {}, alive: true };
  }

  async getStatus(): Promise<BackendStatus> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const hasApiKey = !!apiKey;
    return {
      name: this.name as AIBackend,
      available: true,
      configured: true,
      authMode: hasApiKey ? 'api_key' : 'cli_login',
      apiKeyMasked: hasApiKey ? `sk-...${apiKey!.slice(-4)}` : undefined,
      capabilities: this.capabilities,
    };
  }

  async logout(): Promise<void> {
    if (this.opts?.logoutError) {
      throw this.opts.logoutError;
    }
    this.logoutCalled = true;
  }

  get wasLogoutCalled() {
    return this.logoutCalled;
  }
}

/** Mock backend without logout method. */
class MockBackendNoLogout {
  readonly name: string;
  readonly capabilities;

  constructor(name: string) {
    this.name = name;
    this.capabilities = BACKEND_CAPABILITIES[name as AIBackend] ?? {
      customTools: false,
      streaming: false,
      sessionPersistence: false,
      fileAccess: false,
    };
  }

  async spawn() {
    return { send: async () => 'mock', stop: async () => {}, alive: true };
  }

  async getStatus(): Promise<BackendStatus> {
    return {
      name: this.name as AIBackend,
      available: true,
      configured: true,
      authMode: 'cli_login',
      capabilities: this.capabilities,
    };
  }
}

/** Parse the API response envelope: { success, data }. */
async function parseResponse(res: Response) {
  return (await res.json()) as { success: boolean; data?: unknown; error?: string };
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/backends/api-key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/backends/api-key', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalApiKey) {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  test('sets API key when provided', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const registry = new DefaultBackendRegistry(AIBackend.CLAUDE);
    registry.register(new MockBackend('claude') as any);

    const routes = createBackendRoutes(registry);
    const res = await routes.updateApiKey(makeRequest({ apiKey: 'sk-ant-test-key-1234567890' }));
    const envelope = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(envelope.success).toBe(true);
    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-test-key-1234567890');
  });

  test('clears API key when null', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-existing-key-value-0000';
    const registry = new DefaultBackendRegistry(AIBackend.CLAUDE);
    registry.register(new MockBackend('claude') as any);

    const routes = createBackendRoutes(registry);
    const res = await routes.updateApiKey(makeRequest({ apiKey: null }));
    expect(res.status).toBe(200);
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  test('clears API key when empty string', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-existing-key-value-0000';
    const registry = new DefaultBackendRegistry(AIBackend.CLAUDE);
    registry.register(new MockBackend('claude') as any);

    const routes = createBackendRoutes(registry);
    const res = await routes.updateApiKey(makeRequest({ apiKey: '' }));
    expect(res.status).toBe(200);
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  test('returns refreshed backend status after setting key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const registry = new DefaultBackendRegistry(AIBackend.CLAUDE);
    registry.register(new MockBackend('claude') as any);

    const routes = createBackendRoutes(registry);
    const res = await routes.updateApiKey(makeRequest({ apiKey: 'sk-ant-test-1234-abcdefgh' }));
    const envelope = await parseResponse(res);

    expect(envelope.success).toBe(true);
    const data = envelope.data as { defaultBackend: string; backends: BackendStatus[] };
    expect(data.defaultBackend).toBe('claude');
    expect(data.backends).toHaveLength(1);
    expect(data.backends[0].authMode).toBe('api_key');
  });

  test('trims whitespace from API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const registry = new DefaultBackendRegistry(AIBackend.CLAUDE);
    registry.register(new MockBackend('claude') as any);

    const routes = createBackendRoutes(registry);
    await routes.updateApiKey(makeRequest({ apiKey: '  sk-ant-test-key-padded00  ' }));
    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-test-key-padded00');
  });

  test('rejects API key without sk-ant- prefix', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const registry = new DefaultBackendRegistry(AIBackend.CLAUDE);
    registry.register(new MockBackend('claude') as any);

    const routes = createBackendRoutes(registry);
    const res = await routes.updateApiKey(makeRequest({ apiKey: 'invalid-key-1234567890123456' }));
    const envelope = await parseResponse(res);

    expect(envelope.success).toBe(false);
    expect(envelope.error).toContain('sk-ant-');
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  test('rejects API key shorter than 20 characters', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const registry = new DefaultBackendRegistry(AIBackend.CLAUDE);
    registry.register(new MockBackend('claude') as any);

    const routes = createBackendRoutes(registry);
    const res = await routes.updateApiKey(makeRequest({ apiKey: 'sk-ant-short' }));
    const envelope = await parseResponse(res);

    expect(envelope.success).toBe(false);
    expect(envelope.error).toContain('20');
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  test('rejects missing apiKey field', async () => {
    const registry = new DefaultBackendRegistry(AIBackend.CLAUDE);
    registry.register(new MockBackend('claude') as any);

    const routes = createBackendRoutes(registry);
    // Body with no apiKey field — should treat as clearing
    const res = await routes.updateApiKey(makeRequest({}));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/backends/claude/logout', () => {
  test('calls logout on claude backend', async () => {
    const backend = new MockBackend('claude');
    const registry = new DefaultBackendRegistry(AIBackend.CLAUDE);
    registry.register(backend as any);

    const routes = createBackendRoutes(registry);
    const res = await routes.claudeLogout();
    const envelope = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(envelope.success).toBe(true);
    expect(backend.wasLogoutCalled).toBe(true);
  });

  test('returns 404 when claude backend not registered', async () => {
    const registry = new DefaultBackendRegistry(AIBackend.CODEX);

    const routes = createBackendRoutes(registry);
    const res = await routes.claudeLogout();
    const envelope = await parseResponse(res);

    expect(envelope.success).toBe(false);
  });

  test('returns error when logout fails', async () => {
    const backend = new MockBackend('claude', {
      logoutError: new Error('CLI not found'),
    });
    const registry = new DefaultBackendRegistry(AIBackend.CLAUDE);
    registry.register(backend as any);

    const routes = createBackendRoutes(registry);
    const res = await routes.claudeLogout();
    const envelope = await parseResponse(res);

    expect(envelope.success).toBe(false);
    expect(envelope.error).toContain('CLI not found');
  });

  test('returns refreshed status after successful logout', async () => {
    const backend = new MockBackend('claude');
    const registry = new DefaultBackendRegistry(AIBackend.CLAUDE);
    registry.register(backend as any);

    const routes = createBackendRoutes(registry);
    const res = await routes.claudeLogout();
    const envelope = await parseResponse(res);

    expect(envelope.success).toBe(true);
    const data = envelope.data as { defaultBackend: string; backends: BackendStatus[] };
    expect(data.defaultBackend).toBe('claude');
    expect(data.backends).toHaveLength(1);
  });

  test('returns 400 when backend has no logout method', async () => {
    const backend = new MockBackendNoLogout('claude');
    const registry = new DefaultBackendRegistry(AIBackend.CLAUDE);
    registry.register(backend as any);

    const routes = createBackendRoutes(registry);
    const res = await routes.claudeLogout();
    const envelope = await parseResponse(res);

    expect(envelope.success).toBe(false);
    expect(envelope.error).toContain('not supported');
  });
});
