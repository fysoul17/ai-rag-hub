import { beforeEach, describe, expect, test } from 'bun:test';
import type { BackendRegistry } from '@autonomy/agent-manager';
import { ClaudeBackend } from '@autonomy/agent-manager';
import type { Conductor } from '@autonomy/conductor';
import { WSClientMessageType, WSServerMessageType } from '@autonomy/shared';
import type { ServerWebSocket } from 'bun';
import { createWebSocketHandler, type WSData } from '../src/websocket.ts';
import { MockConductor } from './helpers/mock-conductor.ts';

class MockWebSocket {
  sent: string[] = [];
  closed = false;
  data: WSData;

  constructor(id = 'ws-1') {
    this.data = { id };
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  allMessages(): Array<Record<string, unknown>> {
    return this.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
  }

  lastMessage(): Record<string, unknown> | null {
    const last = this.sent[this.sent.length - 1];
    return last ? (JSON.parse(last) as Record<string, unknown>) : null;
  }
}

function asWS(ws: MockWebSocket): ServerWebSocket<WSData> {
  return ws as unknown as ServerWebSocket<WSData>;
}

/** Create a mock BackendRegistry backed by a real ClaudeBackend. */
function createMockRegistry(): BackendRegistry {
  const claude = new ClaudeBackend();
  return {
    get: () => claude,
    getDefault: () => claude,
    getDefaultName: () => 'claude' as const,
    has: () => true,
    list: () => ['claude' as const],
    getStatusAll: async () => [],
  } as unknown as BackendRegistry;
}

describe('WebSocket slash commands', () => {
  let conductor: MockConductor;
  let registry: BackendRegistry;
  let wsHandler: ReturnType<typeof createWebSocketHandler>;

  beforeEach(() => {
    conductor = new MockConductor();
    conductor.initialized = true;
    registry = createMockRegistry();
    wsHandler = createWebSocketHandler(
      conductor as unknown as Conductor,
      undefined,
      undefined,
      undefined,
      registry,
    );
  });

  test('/help returns available commands', async () => {
    const ws = new MockWebSocket();
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: '/help' }),
    );

    const messages = ws.allMessages();
    expect(messages.length).toBe(2); // CHUNK + COMPLETE
    expect(messages[0].type).toBe(WSServerMessageType.CHUNK);
    expect(messages[0].agentId).toBe('system');
    const content = messages[0].content as string;
    expect(content).toContain('/model');
    expect(content).toContain('/effort');
    expect(content).toContain('/config');
    expect(messages[1].type).toBe(WSServerMessageType.COMPLETE);
  });

  test('/model sonnet sets config override', async () => {
    const ws = new MockWebSocket();
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: '/model sonnet' }),
    );

    const messages = ws.allMessages();
    expect(messages[0].type).toBe(WSServerMessageType.CHUNK);
    const content = messages[0].content as string;
    expect(content).toContain('model');
    expect(content).toContain('sonnet');
    // Check internal state
    expect(ws.data.configOverrides).toEqual({ model: 'sonnet' });
  });

  test('/model without value shows current', async () => {
    const ws = new MockWebSocket();
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: '/model' }),
    );

    const messages = ws.allMessages();
    expect(messages[0].type).toBe(WSServerMessageType.CHUNK);
    const content = messages[0].content as string;
    expect(content).toContain('model');
    // Should show default
    expect(content).toContain('sonnet');
  });

  test('/model invalid-value returns error', async () => {
    const ws = new MockWebSocket();
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: '/model gpt-5' }),
    );

    const messages = ws.allMessages();
    expect(messages[0].type).toBe(WSServerMessageType.CHUNK);
    const content = messages[0].content as string;
    expect(content).toContain('Invalid value');
    // No override set
    expect(ws.data.configOverrides).toBeUndefined();
  });

  test('/config shows current overrides', async () => {
    const ws = new MockWebSocket();
    ws.data.configOverrides = { model: 'opus', effort: 'high' };
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: '/config' }),
    );

    const messages = ws.allMessages();
    expect(messages[0].type).toBe(WSServerMessageType.CHUNK);
    const content = messages[0].content as string;
    expect(content).toContain('model');
    expect(content).toContain('opus');
    expect(content).toContain('effort');
    expect(content).toContain('high');
  });

  test('/config shows defaults when no overrides', async () => {
    const ws = new MockWebSocket();
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: '/config' }),
    );

    const messages = ws.allMessages();
    const content = messages[0].content as string;
    expect(content).toContain('No config overrides');
  });

  test('unknown /foo returns error', async () => {
    const ws = new MockWebSocket();
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: '/foo' }),
    );

    const messages = ws.allMessages();
    expect(messages[0].type).toBe(WSServerMessageType.CHUNK);
    const content = messages[0].content as string;
    expect(content).toContain('Unknown command');
    expect(content).toContain('/help');
  });

  test('non-slash messages are dispatched to conductor', async () => {
    const ws = new MockWebSocket();
    wsHandler.handler.open(asWS(ws));
    conductor.responseContent = 'Normal response';

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello' }),
    );

    expect(conductor.handleMessageCalls.length).toBe(1);
    expect(conductor.handleMessageCalls[0].content).toBe('Hello');
  });

  test('config overrides are passed to conductor in metadata', async () => {
    const ws = new MockWebSocket();
    ws.data.configOverrides = { model: 'opus' };
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hi' }),
    );

    expect(conductor.handleMessageCalls.length).toBe(1);
    expect(conductor.handleMessageCalls[0].metadata).toEqual({
      configOverrides: { model: 'opus' },
    });
  });

  test('setting model invalidates session backend', async () => {
    const ws = new MockWebSocket();
    ws.data.sessionId = 'session-123';
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: '/model opus' }),
    );

    expect(conductor.invalidateSessionBackendCalls).toContain('session-123');
  });

  test('/effort high sets effort override', async () => {
    const ws = new MockWebSocket('ws-effort');
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: '/effort high' }),
    );

    const messages = ws.allMessages();
    const content = messages[0].content as string;
    expect(content).toContain('effort');
    expect(content).toContain('high');
    expect(ws.data.configOverrides).toEqual({ effort: 'high' });
  });

  test('multiple overrides accumulate', async () => {
    const ws = new MockWebSocket('ws-multi');
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: '/model opus' }),
    );
    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: '/effort high' }),
    );

    expect(ws.data.configOverrides).toEqual({ model: 'opus', effort: 'high' });
  });
});
