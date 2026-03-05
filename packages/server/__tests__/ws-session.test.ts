import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, test } from 'bun:test';
import { SessionStore } from '../src/session-store.ts';
import type { WSData } from '../src/websocket.ts';
import { ensureSession, persistAssistantMessage, persistUserMessage } from '../src/ws-session.ts';

/** Create a mock WebSocket with in-memory tracking. */
function mockWs(data?: { sessionId?: string }) {
  const sent: object[] = [];
  return {
    ws: {
      data: { id: 'ws-1', ...data },
      send(raw: string) {
        sent.push(JSON.parse(raw));
      },
    } as unknown as import('bun').ServerWebSocket<WSData>,
    sent,
  };
}

describe('ensureSession', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(new Database(':memory:'));
  });

  test('creates a new session when ws has no sessionId', () => {
    const { ws, sent } = mockWs();
    ensureSession(ws, store);

    // Should have assigned a sessionId to ws.data
    expect(ws.data.sessionId).toBeDefined();
    expect(typeof ws.data.sessionId).toBe('string');

    // Should have sent a SESSION_INIT message
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: 'session_init',
      sessionId: ws.data.sessionId,
    });

    // Session should exist in the store
    const session = store.getById(ws.data.sessionId ?? '');
    expect(session).not.toBeNull();
    expect(session?.title).toBe('New Chat');
  });

  test('does nothing when sessionId is already set', () => {
    const { ws, sent } = mockWs({ sessionId: 'existing-session' });
    ensureSession(ws, store);

    expect(ws.data.sessionId).toBe('existing-session');
    expect(sent).toHaveLength(0);
  });

  test('does nothing when no session store is provided', () => {
    const { ws, sent } = mockWs();
    ensureSession(ws, undefined);

    expect(ws.data.sessionId).toBeUndefined();
    expect(sent).toHaveLength(0);
  });
});

describe('persistUserMessage', () => {
  let store: SessionStore;
  let sessionId: string;

  beforeEach(() => {
    store = new SessionStore(new Database(':memory:'));
    const session = store.create({ title: 'New Chat' });
    sessionId = session.id;
  });

  test('adds a user message to the session', () => {
    persistUserMessage(store, sessionId, 'Hello world');

    const detail = store.getDetail(sessionId);
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.messages[0].role).toBe('user');
    expect(detail?.messages[0].content).toBe('Hello world');
  });

  test('auto-titles session from first user message', () => {
    persistUserMessage(store, sessionId, 'What is the weather?');

    const session = store.getById(sessionId);
    expect(session?.title).toBe('What is the weather?');
  });

  test('truncates long messages for title', () => {
    const longMessage = 'A'.repeat(100);
    persistUserMessage(store, sessionId, longMessage);

    const session = store.getById(sessionId);
    const title = session?.title ?? '';
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain('...');
  });

  test('does not retitle session after first message', () => {
    persistUserMessage(store, sessionId, 'First message');
    persistUserMessage(store, sessionId, 'Second message');

    const session = store.getById(sessionId);
    expect(session?.title).toBe('First message');
  });

  test('does not crash on invalid session ID', () => {
    // Should silently log warning, not throw
    expect(() => persistUserMessage(store, 'nonexistent', 'test')).not.toThrow();
  });
});

describe('persistAssistantMessage', () => {
  let store: SessionStore;
  let sessionId: string;

  beforeEach(() => {
    store = new SessionStore(new Database(':memory:'));
    const session = store.create({ title: 'Test' });
    sessionId = session.id;
  });

  test('adds an assistant message to the session', () => {
    persistAssistantMessage(store, sessionId, 'Here is the answer');

    const detail = store.getDetail(sessionId);
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.messages[0].role).toBe('assistant');
    expect(detail?.messages[0].content).toBe('Here is the answer');
  });

  test('stores targetAgent and metadata', () => {
    persistAssistantMessage(store, sessionId, 'response', 'agent-1', { model: 'claude' });

    const detail = store.getDetail(sessionId);
    expect(detail?.messages[0].agentId).toBe('agent-1');
    expect(detail?.messages[0].metadata).toEqual({ model: 'claude' });
  });

  test('does not crash on invalid session ID', () => {
    expect(() => persistAssistantMessage(store, 'nonexistent', 'test')).not.toThrow();
  });
});
