import { describe, expect, test } from 'bun:test';
import { safeSend, safeSendRaw } from '../src/ws-utils.ts';

/** Create a mock WebSocket that records sent messages. */
function mockWs(options?: { throwOnSend?: boolean }) {
  const sent: string[] = [];
  return {
    ws: {
      data: { id: 'test-ws' },
      send(data: string) {
        if (options?.throwOnSend) throw new Error('WebSocket closed');
        sent.push(data);
      },
    } as unknown as import('bun').ServerWebSocket<{ id: string }>,
    sent,
  };
}

describe('safeSend', () => {
  test('sends JSON-serialized message and returns true', () => {
    const { ws, sent } = mockWs();
    const result = safeSend(ws, { type: 'test', data: 123 });
    expect(result).toBe(true);
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0])).toEqual({ type: 'test', data: 123 });
  });

  test('returns false when ws.send throws', () => {
    const { ws } = mockWs({ throwOnSend: true });
    const result = safeSend(ws, { type: 'test' });
    expect(result).toBe(false);
  });

  test('serializes complex objects', () => {
    const { ws, sent } = mockWs();
    const payload = { nested: { array: [1, 2, 3], flag: true } };
    safeSend(ws, payload);
    expect(JSON.parse(sent[0])).toEqual(payload);
  });
});

describe('safeSendRaw', () => {
  test('sends raw string and returns true', () => {
    const { ws, sent } = mockWs();
    const result = safeSendRaw(ws, '{"pre":"serialized"}');
    expect(result).toBe(true);
    expect(sent).toEqual(['{"pre":"serialized"}']);
  });

  test('returns false when ws.send throws', () => {
    const { ws } = mockWs({ throwOnSend: true });
    const result = safeSendRaw(ws, 'data');
    expect(result).toBe(false);
  });
});
