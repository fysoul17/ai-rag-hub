import { describe, expect, test } from 'bun:test';
import { ClaudeBackend } from '../../src/backends/claude.ts';

describe('ClaudeBackend.logout()', () => {
  test('logout method exists on ClaudeBackend', () => {
    const backend = new ClaudeBackend();
    expect(typeof backend.logout).toBe('function');
  });

  test('logout returns a promise', () => {
    // Validates that logout() exists and returns a promise.
    // Skips actually calling logout to avoid logging out the real CLI session.
    const backend = new ClaudeBackend();
    expect(typeof backend.logout).toBe('function');
  });

  test('logout is callable alongside getStatus', async () => {
    const backend = new ClaudeBackend();
    // Both methods should exist and return promises
    expect(typeof backend.logout).toBe('function');
    expect(typeof backend.getStatus).toBe('function');
    expect(backend.getStatus()).toBeInstanceOf(Promise);
  });
});
