import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { AIBackend, BACKEND_CAPABILITIES } from '@autonomy/shared';
import { OllamaBackend } from '../../src/backends/ollama.ts';

describe('OllamaBackend', () => {
  const backend = new OllamaBackend();

  afterEach(() => {
    delete process.env.OLLAMA_URL;
    delete process.env.OLLAMA_MODEL;
    mock.restore();
  });

  test('has correct name and capabilities', () => {
    expect(backend.name).toBe(AIBackend.OLLAMA);
    expect(backend.capabilities).toEqual(BACKEND_CAPABILITIES[AIBackend.OLLAMA]);
  });

  test('capabilities reflect Ollama limitations', () => {
    expect(backend.capabilities.customTools).toBe(false);
    expect(backend.capabilities.streaming).toBe(true);
    expect(backend.capabilities.sessionPersistence).toBe(false);
    expect(backend.capabilities.fileAccess).toBe(false);
  });

  test('getConfigOptions returns model option', () => {
    const options = backend.getConfigOptions();
    expect(options).toHaveLength(1);
    expect(options[0].name).toBe('model');
    expect(options[0].values).toContain('llama3.2');
    expect(options[0].values).toContain('mistral');
  });

  test('getConfigOptions uses OLLAMA_MODEL env when set', () => {
    process.env.OLLAMA_MODEL = 'custom-model';
    const freshBackend = new OllamaBackend();
    const options = freshBackend.getConfigOptions();
    expect(options[0].defaultValue).toBe('custom-model');
  });

  describe('getStatus()', () => {
    test('reports unavailable when server not reachable', async () => {
      process.env.OLLAMA_URL = 'http://localhost:99999';
      const status = await backend.getStatus();
      expect(status.available).toBe(false);
      expect(status.configured).toBe(false);
      expect(status.authMode).toBe('none');
      expect(status.error).toContain('not reachable');
    });

    test('always reports authMode as none', async () => {
      process.env.OLLAMA_URL = 'http://localhost:99999';
      const status = await backend.getStatus();
      expect(status.authMode).toBe('none');
    });
  });

  test('spawn returns a process', async () => {
    const proc = await backend.spawn({
      agentId: 'test-agent',
      systemPrompt: 'You are a test agent',
    });
    expect(proc).toBeDefined();
    expect(proc.alive).toBe(true);
    await proc.stop();
    expect(proc.alive).toBe(false);
  });

  test('process send throws when not alive', async () => {
    const proc = await backend.spawn({
      agentId: 'test-agent',
      systemPrompt: 'Test',
    });
    await proc.stop();
    expect(proc.alive).toBe(false);
    await expect(proc.send('hello')).rejects.toThrow('not alive');
  });

  test('process sendStreaming yields error when not alive', async () => {
    const proc = await backend.spawn({
      agentId: 'test-agent',
      systemPrompt: 'Test',
    });
    await proc.stop();

    const events = [];
    for await (const event of proc.sendStreaming!('hello')) {
      events.push(event);
    }
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
  });
});
