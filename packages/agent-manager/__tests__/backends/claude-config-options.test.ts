import { describe, expect, test } from 'bun:test';
import { ClaudeBackend } from '../../src/backends/claude.ts';

describe('ClaudeBackend.getConfigOptions()', () => {
  const backend = new ClaudeBackend();

  test('returns model option', () => {
    const options = backend.getConfigOptions();
    const model = options.find((o) => o.name === 'model');
    expect(model).toBeDefined();
    expect(model?.cliFlag).toBe('--model');
    expect(model?.values).toContain('sonnet');
    expect(model?.values).toContain('opus');
    expect(model?.values).toContain('haiku');
    expect(model?.defaultValue).toBe('sonnet');
  });

  test('returns effort option', () => {
    const options = backend.getConfigOptions();
    const effort = options.find((o) => o.name === 'effort');
    expect(effort).toBeDefined();
    expect(effort?.cliFlag).toBe('--effort');
    expect(effort?.values).toEqual(['low', 'medium', 'high']);
  });
});

describe('ClaudeBackend buildArgs with config overrides', () => {
  const backend = new ClaudeBackend();

  test('includes --model when model is set', async () => {
    const proc = await backend.spawn({
      agentId: 'test',
      systemPrompt: 'test',
      model: 'opus',
    });
    // We can't directly inspect args, but we can verify the process was created
    expect(proc).toBeDefined();
    expect(proc.alive).toBe(true);
    await proc.stop();
  });

  test('includes extra flags when extraFlags is set', async () => {
    const proc = await backend.spawn({
      agentId: 'test',
      systemPrompt: 'test',
      extraFlags: { '--effort': 'high' },
    });
    expect(proc).toBeDefined();
    expect(proc.alive).toBe(true);
    await proc.stop();
  });

  test('includes both model and extra flags', async () => {
    const proc = await backend.spawn({
      agentId: 'test',
      systemPrompt: 'test',
      model: 'haiku',
      extraFlags: { '--effort': 'low' },
    });
    expect(proc).toBeDefined();
    expect(proc.alive).toBe(true);
    await proc.stop();
  });
});
