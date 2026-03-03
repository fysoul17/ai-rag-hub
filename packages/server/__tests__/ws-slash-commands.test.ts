import { describe, expect, test } from 'bun:test';
import type { WSData } from '../src/websocket.ts';
import { handleSlashCommand } from '../src/ws-slash-commands.ts';

/** Shape of server-sent WS chunks used in assertions. */
interface SentChunk {
  type: string;
  content?: string;
  agentId?: string;
}

/** Create a mock WebSocket that captures sent messages. */
function mockWs(data?: { configOverrides?: Record<string, string> }) {
  const sent: SentChunk[] = [];
  return {
    ws: {
      data: { id: 'ws-1', sessionId: 'sess-1', ...data },
      send(raw: string) {
        sent.push(JSON.parse(raw));
      },
    } as unknown as import('bun').ServerWebSocket<WSData>,
    sent,
  };
}

/** Create a mock BackendRegistry with configurable options. */
function mockRegistry(options?: import('@autonomy/shared').BackendConfigOption[]) {
  return {
    getDefault: () => ({
      getConfigOptions: () => options ?? [],
    }),
  } as unknown as import('@autonomy/agent-manager').BackendRegistry;
}

describe('handleSlashCommand', () => {
  test('returns false for non-slash messages', () => {
    const { ws } = mockWs();
    expect(handleSlashCommand(ws, 'hello world')).toBe(false);
    expect(handleSlashCommand(ws, '')).toBe(false);
    expect(handleSlashCommand(ws, '  no slash  ')).toBe(false);
  });

  test('returns false for just a /', () => {
    const { ws } = mockWs();
    expect(handleSlashCommand(ws, '/')).toBe(false);
    expect(handleSlashCommand(ws, '/  ')).toBe(false);
  });

  test('/help with no config options reports none available', () => {
    const { ws, sent } = mockWs();
    const registry = mockRegistry([]);
    const handled = handleSlashCommand(ws, '/help', registry);
    expect(handled).toBe(true);
    // Should send a chunk then a complete
    expect(sent).toHaveLength(2);
    expect(sent[0].content).toContain('No configurable options');
  });

  test('/help with config options lists them', () => {
    const { ws, sent } = mockWs();
    const registry = mockRegistry([
      {
        name: 'model',
        description: 'Choose model',
        values: ['opus', 'sonnet'],
        defaultValue: 'sonnet',
      },
    ]);
    const handled = handleSlashCommand(ws, '/help', registry);
    expect(handled).toBe(true);
    expect(sent[0].content).toContain('/model');
    expect(sent[0].content).toContain('opus, sonnet');
    expect(sent[0].content).toContain('default: sonnet');
  });

  test('/config shows no overrides when none set', () => {
    const { ws, sent } = mockWs();
    const handled = handleSlashCommand(ws, '/config');
    expect(handled).toBe(true);
    expect(sent[0].content).toContain('No config overrides');
  });

  test('/config shows existing overrides', () => {
    const { ws, sent } = mockWs({ configOverrides: { model: 'opus' } });
    const handled = handleSlashCommand(ws, '/config');
    expect(handled).toBe(true);
    expect(sent[0].content).toContain('model');
    expect(sent[0].content).toContain('opus');
  });

  test('unknown command sends error message', () => {
    const { ws, sent } = mockWs();
    const registry = mockRegistry([]);
    const handled = handleSlashCommand(ws, '/foobar', registry);
    expect(handled).toBe(true);
    expect(sent[0].content).toContain('Unknown command');
    expect(sent[0].content).toContain('foobar');
  });

  test('config option with no value shows current value', () => {
    const { ws, sent } = mockWs();
    const registry = mockRegistry([
      {
        name: 'model',
        description: 'Choose model',
        values: ['opus', 'sonnet'],
        defaultValue: 'sonnet',
      },
    ]);
    const handled = handleSlashCommand(ws, '/model', registry);
    expect(handled).toBe(true);
    expect(sent[0].content).toContain('model');
    expect(sent[0].content).toContain('sonnet');
  });

  test('setting a valid config value stores override', () => {
    const { ws, sent } = mockWs();
    const registry = mockRegistry([
      { name: 'model', description: 'Choose model', values: ['opus', 'sonnet'] },
    ]);
    const handled = handleSlashCommand(ws, '/model opus', registry);
    expect(handled).toBe(true);
    expect(ws.data.configOverrides).toEqual({ model: 'opus' });
    expect(sent[0].content).toContain('set to');
    expect(sent[0].content).toContain('opus');
  });

  test('setting an invalid config value is rejected', () => {
    const { ws, sent } = mockWs();
    const registry = mockRegistry([
      { name: 'model', description: 'Choose model', values: ['opus', 'sonnet'] },
    ]);
    const handled = handleSlashCommand(ws, '/model haiku', registry);
    expect(handled).toBe(true);
    expect(ws.data.configOverrides).toBeUndefined();
    expect(sent[0].content).toContain('Invalid value');
  });

  test('rejects values with control characters (null byte)', () => {
    const { ws, sent } = mockWs();
    const registry = mockRegistry([{ name: 'model', description: 'Choose model' }]);
    // \0 is not whitespace, so it survives the split and is caught by the regex
    const handled = handleSlashCommand(ws, '/model test\0value', registry);
    expect(handled).toBe(true);
    expect(sent[0].content).toContain('control characters');
  });

  test('rejects values exceeding max length', () => {
    const { ws, sent } = mockWs();
    const registry = mockRegistry([{ name: 'model', description: 'Choose model' }]);
    const longValue = 'a'.repeat(300);
    const handled = handleSlashCommand(ws, `/model ${longValue}`, registry);
    expect(handled).toBe(true);
    expect(sent[0].content).toContain('too long');
  });

  test('invalidates session backend when conductor is provided', () => {
    const { ws } = mockWs();
    const registry = mockRegistry([{ name: 'model', description: 'Choose model' }]);
    let invalidatedSession: string | undefined;
    const mockConductor = {
      invalidateSessionBackend: (sid: string) => {
        invalidatedSession = sid;
      },
    } as unknown as import('@autonomy/conductor').Conductor;

    handleSlashCommand(ws, '/model opus', registry, mockConductor);
    expect(invalidatedSession).toBe('sess-1');
  });
});
