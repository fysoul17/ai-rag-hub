import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { Conductor } from '@autonomy/conductor';
import { MessageRole, WSClientMessageType, WSServerMessageType } from '@autonomy/shared';
import type { ServerWebSocket } from 'bun';
import { SessionStore } from '../src/session-store.ts';
import { createWebSocketHandler, type WSData } from '../src/websocket.ts';
import { MockConductor } from './helpers/mock-conductor.ts';

class MockWebSocket {
  sent: string[] = [];
  closed = false;
  data: WSData;

  constructor(id = 'ws-1', sessionId?: string) {
    this.data = { id, sessionId };
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  lastMessage(): Record<string, unknown> | null {
    const last = this.sent[this.sent.length - 1];
    return last ? (JSON.parse(last) as Record<string, unknown>) : null;
  }

  allMessages(): Array<Record<string, unknown>> {
    return this.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
  }
}

function asWS(ws: MockWebSocket): ServerWebSocket<WSData> {
  return ws as unknown as ServerWebSocket<WSData>;
}

describe('WebSocket session support', () => {
  let conductor: MockConductor;
  let db: Database;
  let sessionStore: SessionStore;
  let wsHandler: ReturnType<typeof createWebSocketHandler>;

  beforeEach(() => {
    conductor = new MockConductor();
    conductor.initialized = true;
    db = new Database(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    sessionStore = new SessionStore(db);
    wsHandler = createWebSocketHandler(conductor as unknown as Conductor, undefined, sessionStore);
  });

  test('sends session_init on open when sessionId is present', () => {
    const session = sessionStore.create({ title: 'WS Test' });
    const ws = new MockWebSocket('ws-1', session.id);
    wsHandler.handler.open(asWS(ws));

    const messages = ws.allMessages();
    expect(messages.length).toBe(1);
    expect(messages[0].type).toBe(WSServerMessageType.SESSION_INIT);
    expect(messages[0].sessionId).toBe(session.id);
  });

  test('does not send session_init when no sessionId', () => {
    const ws = new MockWebSocket('ws-1');
    wsHandler.handler.open(asWS(ws));

    expect(ws.sent.length).toBe(0);
  });

  test('persists user message on conductor message', async () => {
    const session = sessionStore.create({});
    const ws = new MockWebSocket('ws-1', session.id);
    wsHandler.handler.open(asWS(ws));

    // Clear session_init message
    ws.sent = [];

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello from user' }),
    );

    const detail = sessionStore.getDetail(session.id);
    expect(detail?.messages.length).toBe(2); // user + assistant
    expect(detail?.messages[0].role).toBe(MessageRole.USER);
    expect(detail?.messages[0].content).toBe('Hello from user');
  });

  test('persists assistant response after conductor reply', async () => {
    const session = sessionStore.create({});
    const ws = new MockWebSocket('ws-1', session.id);
    wsHandler.handler.open(asWS(ws));

    conductor.responseContent = 'Assistant reply';

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hi' }),
    );

    const detail = sessionStore.getDetail(session.id);
    expect(detail?.messages.length).toBe(2);
    expect(detail?.messages[1].role).toBe(MessageRole.ASSISTANT);
    expect(detail?.messages[1].content).toBe('Assistant reply');
  });

  test('lazily creates session on first message when no sessionId', async () => {
    const ws = new MockWebSocket('ws-1');
    wsHandler.handler.open(asWS(ws));

    // No session_init sent on open (no sessionId yet)
    expect(ws.sent.length).toBe(0);

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello' }),
    );

    // Should have created a session lazily and sent session_init
    const sessionInit = ws.sent.find(
      (m) => JSON.parse(m).type === WSServerMessageType.SESSION_INIT,
    );
    expect(sessionInit).toBeDefined();
    const initParsed = JSON.parse(sessionInit as string);
    expect(initParsed.sessionId).toBeDefined();

    // Message should be persisted to the new session
    const result = sessionStore.list();
    expect(result.total).toBe(1);
    const detail = sessionStore.getDetail(initParsed.sessionId);
    expect(detail?.messages.length).toBeGreaterThanOrEqual(1);
    expect(detail?.messages[0].content).toBe('Hello');
  });

  test('updates session message count after messages', async () => {
    const session = sessionStore.create({});
    const ws = new MockWebSocket('ws-1', session.id);
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Test' }),
    );

    const updated = sessionStore.getById(session.id);
    expect(updated?.messageCount).toBe(2); // user + assistant
  });

  test('still works when session store addMessage fails', async () => {
    const session = sessionStore.create({});
    const ws = new MockWebSocket('ws-1', session.id);
    wsHandler.handler.open(asWS(ws));
    ws.sent = [];

    // Sabotage addMessage
    const origAddMessage = sessionStore.addMessage.bind(sessionStore);
    let callCount = 0;
    sessionStore.addMessage = (...args) => {
      callCount++;
      if (callCount === 1) throw new Error('DB write failed');
      return origAddMessage(...args);
    };

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Still works' }),
    );

    // Should still get chunk + complete from conductor
    const messages = ws.allMessages();
    const chunkMsg = messages.find((m) => m.type === WSServerMessageType.CHUNK);
    const completeMsg = messages.find((m) => m.type === WSServerMessageType.COMPLETE);
    expect(chunkMsg).toBeDefined();
    expect(completeMsg).toBeDefined();
  });

  test('ping/pong still works with session store', async () => {
    const session = sessionStore.create({});
    const ws = new MockWebSocket('ws-1', session.id);
    wsHandler.handler.open(asWS(ws));
    ws.sent = [];

    await wsHandler.handler.message(asWS(ws), JSON.stringify({ type: WSClientMessageType.PING }));

    expect(ws.lastMessage()?.type).toBe(WSServerMessageType.PONG);
  });

  test('persists assistant message with agentId when targeted', async () => {
    const session = sessionStore.create({});
    const ws = new MockWebSocket('ws-1', session.id);
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({
        type: WSClientMessageType.MESSAGE,
        content: 'Hi agent',
        targetAgent: 'agent-1',
      }),
    );

    const detail = sessionStore.getDetail(session.id);
    const assistantMsg = detail?.messages.find((m) => m.role === MessageRole.ASSISTANT);
    expect(assistantMsg?.agentId).toBe('agent-1');
  });
});
