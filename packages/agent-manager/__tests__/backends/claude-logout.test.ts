import { describe, expect, test } from 'bun:test';
import { ClaudeBackend } from '../../src/backends/claude.ts';

describe('ClaudeBackend.logout()', () => {
  test('logout method exists on ClaudeBackend', () => {
    const backend = new ClaudeBackend();
    expect(typeof backend.logout).toBe('function');
  });

  test('logout rejects when claude CLI is not available', async () => {
    // In test environments, claude CLI is typically not installed.
    // This test validates that logout() propagates CLI errors correctly.
    const backend = new ClaudeBackend();

    // If claude is installed, logout might succeed. If not, it should throw.
    const cliPath = typeof Bun !== 'undefined' ? Bun.which('claude') : null;
    if (!cliPath) {
      expect(backend.logout()).rejects.toThrow();
    } else {
      // If CLI is available, just verify it returns a promise
      expect(backend.logout()).toBeInstanceOf(Promise);
    }
  });

  test('logout is callable alongside getStatus', async () => {
    const backend = new ClaudeBackend();
    // Both methods should exist and return promises
    expect(typeof backend.logout).toBe('function');
    expect(typeof backend.getStatus).toBe('function');
    expect(backend.getStatus()).toBeInstanceOf(Promise);
  });
});
