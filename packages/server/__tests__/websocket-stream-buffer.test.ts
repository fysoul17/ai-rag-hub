/**
 * WebSocket Stream Buffer Tests
 *
 * Tests for server-side stream buffering and reconnection replay.
 * When a user navigates away from the chat page mid-stream, the server:
 * 1. Continues consuming from the conductor's async generator
 * 2. Buffers all content server-side
 * 3. Sends a single `stream_resume` message when the client reconnects
 * 4. Keeps the buffer alive for 30s (TTL) after completion for late reconnects
 *
 * These tests use `ControllableMockConductor` from the shared mock helper,
 * which yields chunks only when explicitly pushed from test code.
 */
import { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Conductor } from '@autonomy/conductor';
import { WSClientMessageType, WSServerMessageType } from '@autonomy/shared';
import type { ServerWebSocket } from 'bun';
import { SessionStore } from '../src/session-store.ts';
import { createWebSocketHandler, type WSData } from '../src/websocket.ts';
import { ControllableMockConductor, MockConductor } from './helpers/mock-conductor.ts';

// ---------------------------------------------------------------------------
// MockWebSocket — throws on send when closed (simulates real browser behaviour)
// ---------------------------------------------------------------------------

class MockWebSocket {
  sent: string[] = [];
  closed = false;
  data: WSData;

  constructor(id: string, sessionId?: string) {
    this.data = { id, sessionId };
  }

  send(data: string): void {
    if (this.closed) {
      throw new Error('WebSocket is closed');
    }
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

  messagesOfType(type: string): Array<Record<string, unknown>> {
    return this.allMessages().filter((m) => m.type === type);
  }

  clearSent(): void {
    this.sent = [];
  }
}

function asWS(ws: MockWebSocket): ServerWebSocket<WSData> {
  return ws as unknown as ServerWebSocket<WSData>;
}

let idCounter = 0;
function uid(prefix = 'ws-sbuf'): string {
  return `${prefix}-${++idCounter}`;
}

function tick(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Shared test setup
// ---------------------------------------------------------------------------

let conductor: ControllableMockConductor;
let db: Database;
let sessionStore: SessionStore;
let wsHandler: ReturnType<typeof createWebSocketHandler>;

beforeEach(() => {
  conductor = new ControllableMockConductor();
  conductor.initialized = true;
  db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  sessionStore = new SessionStore(db);
  wsHandler = createWebSocketHandler(conductor as unknown as Conductor, undefined, sessionStore);
});

afterEach(() => {
  wsHandler.shutdown();
});

// ---------------------------------------------------------------------------
// 1. Basic buffering
// ---------------------------------------------------------------------------
describe('StreamBuffer — basic accumulation', () => {
  test('buffer accumulates chunk content while streaming', async () => {
    const session = sessionStore.create({ title: 'Test' });
    const ws = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws));
    ws.clearSent();

    const msgPromise = wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello' }),
    ) as Promise<void>;
    await tick();

    conductor.emitChunk('Hello ');
    await tick();
    conductor.emitChunk('World');
    await tick();
    conductor.emitComplete();
    await msgPromise;

    const buffer = wsHandler.bufferManager.get(session.id);
    expect(buffer).toBeDefined();
    expect(buffer?.accumulatedContent).toBe('Hello World');
    expect(buffer?.status).toBe('complete');
  });

  test('happy path — no disconnect, chunks delivered directly to ws', async () => {
    const session = sessionStore.create({ title: 'Test' });
    const ws = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws));
    ws.clearSent();

    const msgPromise = wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hi' }),
    ) as Promise<void>;
    await tick();

    conductor.emitChunk('chunk one');
    await tick();
    conductor.emitComplete();
    await msgPromise;

    const chunks = ws.messagesOfType(WSServerMessageType.CHUNK);
    const completes = ws.messagesOfType(WSServerMessageType.COMPLETE);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe('chunk one');
    expect(completes.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Disconnect mid-stream → buffer accumulates → reconnect gets stream_resume
// ---------------------------------------------------------------------------
describe('StreamBuffer — disconnect mid-stream', () => {
  test('server continues buffering after WS disconnect', async () => {
    const session = sessionStore.create({ title: 'Test' });
    const ws = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws));
    ws.clearSent();

    const msgPromise = wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello' }),
    ) as Promise<void>;
    await tick();

    conductor.emitChunk('Part 1 ');
    await tick();

    // Disconnect — ws.send will now throw; server should continue buffering
    wsHandler.handler.close(asWS(ws));

    conductor.emitChunk('Part 2');
    await tick();
    conductor.emitComplete();
    await msgPromise;

    const buffer = wsHandler.bufferManager.get(session.id);
    expect(buffer).toBeDefined();
    expect(buffer?.accumulatedContent).toBe('Part 1 Part 2');
    expect(buffer?.status).toBe('complete');

    // Persisted to session store even though client disconnected
    const detail = sessionStore.getDetail(session.id);
    const assistantMsg = detail?.messages.find((m) => m.role === 'assistant');
    expect(assistantMsg?.content).toBe('Part 1 Part 2');
  });

  test('reconnect mid-stream receives stream_resume with streaming=true', async () => {
    const session = sessionStore.create({ title: 'Test' });
    const ws1 = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws1));
    ws1.clearSent();

    const msgPromise = wsHandler.handler.message(
      asWS(ws1),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello' }),
    ) as Promise<void>;
    await tick();

    conductor.emitChunk('Accumulated so far');
    await tick();

    // Disconnect ws1
    wsHandler.handler.close(asWS(ws1));

    // Reconnect while still streaming
    const ws2 = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws2));

    const resumeMsgs = ws2.messagesOfType(WSServerMessageType.STREAM_RESUME);
    expect(resumeMsgs.length).toBe(1);
    expect(resumeMsgs[0].content).toBe('Accumulated so far');
    expect(resumeMsgs[0].streaming).toBe(true);
    expect(resumeMsgs[0].agentId).toBe('conductor');

    // Subsequent live chunks go to ws2 via sessionClients broadcast
    ws2.clearSent();
    conductor.emitChunk(' more');
    await tick();
    conductor.emitComplete();
    await msgPromise;
    await tick();

    const liveChunks = ws2.messagesOfType(WSServerMessageType.CHUNK);
    expect(liveChunks.length).toBe(1);
    expect(liveChunks[0].content).toBe(' more');

    const completes = ws2.messagesOfType(WSServerMessageType.COMPLETE);
    expect(completes.length).toBe(1);
  });

  test('reconnect after stream completed receives stream_resume with streaming=false', async () => {
    const session = sessionStore.create({ title: 'Test' });
    const ws1 = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws1));
    ws1.clearSent();

    const msgPromise = wsHandler.handler.message(
      asWS(ws1),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello' }),
    ) as Promise<void>;
    await tick();

    conductor.emitChunk('Full response');
    await tick();
    conductor.emitComplete();
    await msgPromise;

    wsHandler.handler.close(asWS(ws1));

    // Reconnect after completion (within TTL window)
    const ws2 = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws2));

    const resumeMsgs = ws2.messagesOfType(WSServerMessageType.STREAM_RESUME);
    expect(resumeMsgs.length).toBe(1);
    expect(resumeMsgs[0].content).toBe('Full response');
    expect(resumeMsgs[0].streaming).toBe(false);
  });

  test('multiple disconnect/reconnect cycles each receive full accumulated content', async () => {
    const session = sessionStore.create({ title: 'Test' });
    const ws1 = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws1));
    ws1.clearSent();

    const msgPromise = wsHandler.handler.message(
      asWS(ws1),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello' }),
    ) as Promise<void>;
    await tick();

    conductor.emitChunk('A');
    await tick();
    wsHandler.handler.close(asWS(ws1));

    conductor.emitChunk('B');
    await tick();

    // Second reconnect mid-stream
    const ws2 = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws2));

    const resume1 = ws2.messagesOfType(WSServerMessageType.STREAM_RESUME);
    expect(resume1[0].content).toBe('AB');
    expect(resume1[0].streaming).toBe(true);

    wsHandler.handler.close(asWS(ws2));

    conductor.emitChunk('C');
    await tick();
    conductor.emitComplete();
    await msgPromise;

    // Third reconnect after completion
    const ws3 = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws3));

    const resume2 = ws3.messagesOfType(WSServerMessageType.STREAM_RESUME);
    expect(resume2[0].content).toBe('ABC');
    expect(resume2[0].streaming).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Buffer cleanup
// ---------------------------------------------------------------------------
describe('StreamBuffer — cleanup', () => {
  test('no stream_resume sent if no prior buffer for session', () => {
    const session = sessionStore.create({ title: 'Test' });
    const ws = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws));

    const resumeMsgs = ws.messagesOfType(WSServerMessageType.STREAM_RESUME);
    expect(resumeMsgs.length).toBe(0);
  });

  test('cleanup removes completed buffers past TTL', () => {
    const manager = wsHandler.bufferManager;
    const buf = manager.getOrCreate('session-old', 'conductor');
    buf.append({ type: 'chunk', content: 'old content' });
    buf.markComplete();
    // Force completedAt to be expired
    (buf as { completedAt: number }).completedAt = Date.now() - 31_000;

    expect(manager.size).toBe(1);
    manager.cleanup();
    expect(manager.size).toBe(0);
  });

  test('active streaming buffer is not cleaned up', () => {
    const manager = wsHandler.bufferManager;
    manager.getOrCreate('session-active', 'conductor'); // status = 'streaming'

    manager.cleanup();
    expect(manager.size).toBe(1);
  });

  test('completed buffer within TTL is kept (for late reconnects)', () => {
    const manager = wsHandler.bufferManager;
    const buf = manager.getOrCreate('session-fresh', 'conductor');
    buf.append({ type: 'chunk', content: 'content' });
    buf.markComplete();
    // completedAt is NOW — within TTL

    manager.cleanup();
    expect(manager.size).toBe(1); // still there
  });
});

// ---------------------------------------------------------------------------
// 4. Concurrent sessions — isolated buffers
// ---------------------------------------------------------------------------
describe('StreamBuffer — session isolation', () => {
  test('concurrent sessions have isolated buffers', async () => {
    const sessionA = sessionStore.create({ title: 'A' });
    const sessionB = sessionStore.create({ title: 'B' });

    const conductorA = new ControllableMockConductor();
    conductorA.initialized = true;
    const conductorB = new ControllableMockConductor();
    conductorB.initialized = true;

    const handlerA = createWebSocketHandler(
      conductorA as unknown as Conductor,
      undefined,
      sessionStore,
    );
    const handlerB = createWebSocketHandler(
      conductorB as unknown as Conductor,
      undefined,
      sessionStore,
    );

    const wsA = new MockWebSocket(uid(), sessionA.id);
    const wsB = new MockWebSocket(uid(), sessionB.id);
    handlerA.handler.open(asWS(wsA));
    handlerB.handler.open(asWS(wsB));

    const promiseA = handlerA.handler.message(
      asWS(wsA),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello A' }),
    ) as Promise<void>;
    const promiseB = handlerB.handler.message(
      asWS(wsB),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello B' }),
    ) as Promise<void>;

    await tick();
    conductorA.emitChunk('Response A');
    conductorB.emitChunk('Response B');
    await tick();
    conductorA.emitComplete();
    conductorB.emitComplete();
    await Promise.all([promiseA, promiseB]);

    const bufA = handlerA.bufferManager.get(sessionA.id);
    const bufB = handlerB.bufferManager.get(sessionB.id);
    expect(bufA?.accumulatedContent).toBe('Response A');
    expect(bufB?.accumulatedContent).toBe('Response B');

    handlerA.shutdown();
    handlerB.shutdown();
  });
});

// ---------------------------------------------------------------------------
// 5. Error handling
// ---------------------------------------------------------------------------
describe('StreamBuffer — error handling', () => {
  test('stream error after partial content completes normally', async () => {
    const session = sessionStore.create({ title: 'Test' });
    const ws = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws));
    ws.clearSent();

    const msgPromise = wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello' }),
    ) as Promise<void>;
    await tick();

    conductor.emitChunk('Some content');
    await tick();
    conductor.emitError('backend failed after content');
    await msgPromise;

    const buffer = wsHandler.bufferManager.get(session.id);
    expect(buffer?.accumulatedContent).toBe('Some content');
    expect(buffer?.status).toBe('complete'); // error-after-content → complete normally

    const errors = ws.messagesOfType(WSServerMessageType.ERROR);
    expect(errors.length).toBe(0); // no error sent to client
    const completes = ws.messagesOfType(WSServerMessageType.COMPLETE);
    expect(completes.length).toBe(1);
  });

  test('stream error with no content marks buffer as error and sends error to client', async () => {
    const session = sessionStore.create({ title: 'Test' });
    const ws = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws));
    ws.clearSent();

    const msgPromise = wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello' }),
    ) as Promise<void>;
    await tick();

    conductor.emitError('fatal error');
    await msgPromise;

    const buffer = wsHandler.bufferManager.get(session.id);
    expect(buffer?.status).toBe('error');

    const errors = ws.messagesOfType(WSServerMessageType.ERROR);
    expect(errors.length).toBe(1);
  });

  test('closed socket does not crash the streaming loop', async () => {
    const session = sessionStore.create({ title: 'Test' });
    const ws = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws));
    ws.clearSent();

    const msgPromise = wsHandler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello' }),
    ) as Promise<void>;
    await tick();

    conductor.emitChunk('first chunk');
    await tick();

    // Simulate abrupt socket close — future sends will throw
    ws.closed = true;
    wsHandler.handler.close(asWS(ws));

    // These should not throw even though ws is closed
    conductor.emitChunk('second chunk');
    await tick();
    conductor.emitComplete();

    // Should resolve without throwing
    await expect(msgPromise).resolves.toBeUndefined();

    const buffer = wsHandler.bufferManager.get(session.id);
    expect(buffer?.accumulatedContent).toBe('first chunksecond chunk');
    expect(buffer?.status).toBe('complete');
  });
});

// ---------------------------------------------------------------------------
// 6. Backward compatibility — no sessionId, no buffer
// ---------------------------------------------------------------------------
describe('StreamBuffer — backward compatibility', () => {
  test('no sessionId means no buffer created and chunks sent directly', async () => {
    const mockConductor = new MockConductor();
    mockConductor.initialized = true;
    const handler = createWebSocketHandler(mockConductor as unknown as Conductor);

    const ws = new MockWebSocket(uid()); // no sessionId
    handler.handler.open(asWS(ws));

    await handler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hello' }),
    );

    expect(handler.bufferManager.size).toBe(0);

    const chunks = ws.messagesOfType(WSServerMessageType.CHUNK);
    const completes = ws.messagesOfType(WSServerMessageType.COMPLETE);
    expect(chunks.length).toBe(1);
    expect(completes.length).toBe(1);

    handler.shutdown();
  });

  test('synchronous stream (MockConductor) still works end-to-end', async () => {
    const mockConductor = new MockConductor();
    mockConductor.initialized = true;
    mockConductor.responseContent = 'Sync response';
    const handler = createWebSocketHandler(
      mockConductor as unknown as Conductor,
      undefined,
      sessionStore,
    );

    const session = sessionStore.create({ title: 'Sync Test' });
    const ws = new MockWebSocket(uid(), session.id);
    handler.handler.open(asWS(ws));
    ws.clearSent();

    await handler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hi' }),
    );

    const chunk = ws.messagesOfType(WSServerMessageType.CHUNK)[0];
    expect(chunk?.content).toBe('Sync response');
    expect(ws.messagesOfType(WSServerMessageType.COMPLETE).length).toBe(1);

    handler.shutdown();
  });

  test('ping/pong unaffected by buffer layer', async () => {
    const session = sessionStore.create({ title: 'Ping Test' });
    const ws = new MockWebSocket(uid(), session.id);
    wsHandler.handler.open(asWS(ws));
    ws.clearSent();

    await wsHandler.handler.message(asWS(ws), JSON.stringify({ type: WSClientMessageType.PING }));

    expect(ws.lastMessage()?.type).toBe(WSServerMessageType.PONG);
  });

  test('error handling still works with buffer layer', async () => {
    const mockConductor = new MockConductor();
    mockConductor.initialized = true;
    mockConductor.shouldThrow = true;
    const handler = createWebSocketHandler(
      mockConductor as unknown as Conductor,
      undefined,
      sessionStore,
    );

    const session = sessionStore.create({ title: 'Error Test' });
    const ws = new MockWebSocket(uid(), session.id);
    handler.handler.open(asWS(ws));
    ws.clearSent();

    await handler.handler.message(
      asWS(ws),
      JSON.stringify({ type: WSClientMessageType.MESSAGE, content: 'Hi' }),
    );

    const errors = ws.messagesOfType(WSServerMessageType.ERROR);
    expect(errors.length).toBeGreaterThanOrEqual(1);

    handler.shutdown();
  });
});
