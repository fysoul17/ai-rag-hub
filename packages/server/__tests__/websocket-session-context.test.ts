/**
 * WebSocket Session Context — Tests for session ID handling.
 *
 * Architecture: The server auto-creates a session on WS connect (index.ts),
 * so ws.data.sessionId is ALWAYS set. These tests verify that the websocket
 * handler correctly passes the session ID to the conductor and persists messages.
 */

import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { Conductor } from '@autonomy/conductor';
import { WSClientMessageType, WSServerMessageType } from '@autonomy/shared';
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

describe('WebSocket session handling', () => {
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

  test('IncomingMessage.sessionId uses ws.data.sessionId', async () => {
    const session = sessionStore.create({ title: 'Context Test' });
    const ws = new MockWebSocket('ws-random-uuid', session.id);
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello' }),
    );

    const incomingMessage = conductor.handleMessageCalls[0];
    expect(incomingMessage).toBeDefined();
    expect(incomingMessage.sessionId).toBe(session.id);
    expect(incomingMessage.sessionId).not.toBe('ws-random-uuid');
  });

  test('session context preserved across multiple messages', async () => {
    const session = sessionStore.create({ title: 'Multi-Message Test' });
    const ws = new MockWebSocket('ws-conn-1', session.id);
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'First message' }),
    );

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Second message' }),
    );

    expect(conductor.handleMessageCalls.length).toBe(2);
    expect(conductor.handleMessageCalls[0].sessionId).toBe(session.id);
    expect(conductor.handleMessageCalls[1].sessionId).toBe(session.id);
  });

  test('different sessions use their respective IDs', async () => {
    const session1 = sessionStore.create({ title: 'Session 1' });
    const session2 = sessionStore.create({ title: 'Session 2' });

    const ws1 = new MockWebSocket('ws-a', session1.id);
    const ws2 = new MockWebSocket('ws-b', session2.id);

    wsHandler.handler.open(asWS(ws1));
    wsHandler.handler.open(asWS(ws2));

    await wsHandler.handler.message(
      asWS(ws1),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'From session 1' }),
    );

    await wsHandler.handler.message(
      asWS(ws2),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'From session 2' }),
    );

    expect(conductor.handleMessageCalls[0].sessionId).toBe(session1.id);
    expect(conductor.handleMessageCalls[1].sessionId).toBe(session2.id);
  });

  test('messages are persisted to session store', async () => {
    const session = sessionStore.create({ title: 'New Chat' });
    const ws = new MockWebSocket('ws-persist', session.id);
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Save this' }),
    );

    const detail = sessionStore.getDetail(session.id);
    expect(detail).not.toBeNull();
    expect(detail?.messages.length).toBeGreaterThanOrEqual(1);
    expect(detail?.messages[0].content).toBe('Save this');
  });

  test('session_init sent on open when sessionId is set', () => {
    const session = sessionStore.create({ title: 'Init Test' });
    const ws = new MockWebSocket('ws-init', session.id);
    wsHandler.handler.open(asWS(ws));

    const sessionInits = ws
      .allMessages()
      .filter((m) => m.type === WSServerMessageType.SESSION_INIT);
    expect(sessionInits.length).toBe(1);
    expect(sessionInits[0].sessionId).toBe(session.id);
  });

  test('auto-titles session from first user message', async () => {
    const session = sessionStore.create({ title: 'New Chat' });
    const ws = new MockWebSocket('ws-title', session.id);
    wsHandler.handler.open(asWS(ws));

    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'What is the weather today?' }),
    );

    const updated = sessionStore.getById(session.id);
    expect(updated).not.toBeNull();
    expect(updated?.title).toBe('What is the weather today?');
  });

  test('auto-title truncates long messages', async () => {
    const session = sessionStore.create({ title: 'New Chat' });
    const ws = new MockWebSocket('ws-long-title', session.id);
    wsHandler.handler.open(asWS(ws));

    const longMessage = 'A'.repeat(100);
    await wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: longMessage }),
    );

    const updated = sessionStore.getById(session.id);
    expect(updated?.title.length).toBeLessThanOrEqual(60);
    expect(updated?.title).toEndWith('...');
  });
});
