import { describe, expect, test } from 'bun:test';
import type { AgentRuntimeInfo, MemorySearchResult } from '@autonomy/shared';
import { buildMemoryAugmentedPrompt } from '../src/conductor-prompt.ts';

/** Helper: build a minimal IncomingMessage. */
function msg(content: string) {
  return { content, senderId: 'user-1', senderName: 'User' };
}

/** Helper: build a MemorySearchResult with the given entry contents. */
function memoryResult(...entries: string[]): MemorySearchResult {
  return {
    entries: entries.map((content) => ({
      id: crypto.randomUUID(),
      content,
      similarity: 0.9,
      metadata: {},
    })),
  };
}

const NO_AGENTS: AgentRuntimeInfo[] = [];

describe('buildMemoryAugmentedPrompt', () => {
  test('returns prompt with system context when no memory', () => {
    const result = buildMemoryAugmentedPrompt(msg('Hello'), null, NO_AGENTS, false, false);
    expect(result).toContain('<system-context>');
    expect(result).toContain('Hello');
    // No memory-context block
    expect(result).not.toContain('<memory-context>');
  });

  test('returns prompt with system context when memory is empty', () => {
    const result = buildMemoryAugmentedPrompt(
      msg('Hello'),
      { entries: [] },
      NO_AGENTS,
      false,
      false,
    );
    expect(result).not.toContain('<memory-context>');
    expect(result).toContain('Hello');
  });

  test('injects memory context when entries exist', () => {
    const memory = memoryResult('fact-1', 'fact-2');
    const result = buildMemoryAugmentedPrompt(msg('question'), memory, NO_AGENTS, false, true);
    expect(result).toContain('<memory-context>');
    expect(result).toContain('fact-1');
    expect(result).toContain('fact-2');
    expect(result).toContain('question');
  });

  test('limits memory entries to MAX_RAG_CONTEXT_ENTRIES (3)', () => {
    const memory = memoryResult('a', 'b', 'c', 'd', 'e');
    const result = buildMemoryAugmentedPrompt(msg('q'), memory, NO_AGENTS, false, true);
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toContain('c');
    expect(result).not.toContain('---\nd');
  });

  test('separates memory entries with ---', () => {
    const memory = memoryResult('entry-one', 'entry-two');
    const result = buildMemoryAugmentedPrompt(msg('q'), memory, NO_AGENTS, false, true);
    expect(result).toContain('entry-one\n---\nentry-two');
  });

  test('includes memory rules for connected memory', () => {
    const result = buildMemoryAugmentedPrompt(msg('Hello'), null, NO_AGENTS, false, true);
    expect(result).toContain('Memory is automatic');
  });

  test('includes disabled memory rules when disconnected', () => {
    const result = buildMemoryAugmentedPrompt(msg('Hello'), null, NO_AGENTS, false, false);
    expect(result).toContain('Memory is NOT connected');
  });

  test('includes cron action when cronEnabled', () => {
    const result = buildMemoryAugmentedPrompt(msg('Hello'), null, NO_AGENTS, true, false);
    expect(result).toContain('create_cron');
  });

  test('excludes cron action when disabled', () => {
    const result = buildMemoryAugmentedPrompt(msg('Hello'), null, NO_AGENTS, false, false);
    expect(result).not.toContain('create_cron');
  });

  test('includes agent list in system context', () => {
    const agents: AgentRuntimeInfo[] = [
      { id: 'a1', name: 'Researcher', role: 'Research assistant', status: 'idle' },
    ];
    const result = buildMemoryAugmentedPrompt(msg('Hello'), null, agents, false, false);
    expect(result).toContain('Researcher');
    expect(result).toContain('a1');
  });

  test('preserves original message content exactly', () => {
    const content = 'What is the weather like today?';
    const result = buildMemoryAugmentedPrompt(msg(content), null, NO_AGENTS, false, false);
    expect(result).toContain(content);
  });

  test('ordering: system-context first, then memory-context, then user message', () => {
    const memory = memoryResult('remembered-fact');
    const result = buildMemoryAugmentedPrompt(msg('user-query'), memory, NO_AGENTS, false, true);

    const systemIdx = result.indexOf('<system-context>');
    const memoryIdx = result.indexOf('<memory-context>');
    const userIdx = result.indexOf('user-query');

    expect(systemIdx).toBeLessThan(memoryIdx);
    expect(memoryIdx).toBeLessThan(userIdx);
  });
});
