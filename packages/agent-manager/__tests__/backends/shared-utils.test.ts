import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { buildSafeEnv, maskApiKey } from '../../src/backends/shared-utils.ts';

describe('maskApiKey', () => {
  test('returns undefined for undefined input', () => {
    expect(maskApiKey(undefined)).toBeUndefined();
  });

  test('returns undefined for empty string', () => {
    expect(maskApiKey('')).toBeUndefined();
  });

  test('returns undefined for short keys (< 12 chars)', () => {
    expect(maskApiKey('abc')).toBeUndefined();
    expect(maskApiKey('12345678901')).toBeUndefined(); // 11 chars
  });

  test('returns undefined for exactly 11 characters', () => {
    expect(maskApiKey('abcdefghijk')).toBeUndefined();
  });

  test('masks key of exactly 12 characters', () => {
    expect(maskApiKey('abcdefghijkl')).toBe('...ijkl');
  });

  test('masks long API key showing last 4 chars', () => {
    expect(maskApiKey('sk-1234567890abcdef')).toBe('...cdef');
  });

  test('masks key with special characters', () => {
    expect(maskApiKey('sk-proj-ABCDEFGHIJ!@#$')).toBe('...!@#$');
  });
});

describe('buildSafeEnv', () => {
  beforeEach(() => {
    // Set controlled env vars for testing
    process.env.TEST_KEY_A = 'value-a';
    process.env.TEST_KEY_B = 'value-b';
    process.env.TEST_KEY_C = 'value-c';
  });

  afterEach(() => {
    // Restore original env
    delete process.env.TEST_KEY_A;
    delete process.env.TEST_KEY_B;
    delete process.env.TEST_KEY_C;
    delete process.env.TEST_MAPPED;
  });

  test('returns empty object when no allowed keys match', () => {
    const env = buildSafeEnv(['NONEXISTENT_KEY_XYZ']);
    expect(env).toEqual({});
  });

  test('forwards only allowed keys', () => {
    const env = buildSafeEnv(['TEST_KEY_A', 'TEST_KEY_B']);
    expect(env.TEST_KEY_A).toBe('value-a');
    expect(env.TEST_KEY_B).toBe('value-b');
    expect(env.TEST_KEY_C).toBeUndefined();
  });

  test('skips keys not present in process.env', () => {
    const env = buildSafeEnv(['TEST_KEY_A', 'MISSING_KEY']);
    expect(Object.keys(env)).toEqual(['TEST_KEY_A']);
  });

  test('applies key mappings when target is not set', () => {
    const env = buildSafeEnv(['TEST_KEY_A'], { TEST_KEY_A: 'TEST_MAPPED' });
    expect(env.TEST_KEY_A).toBe('value-a');
    expect(env.TEST_MAPPED).toBe('value-a');
  });

  test('does not overwrite existing target with key mapping', () => {
    process.env.TEST_MAPPED = 'original';
    const env = buildSafeEnv(['TEST_KEY_A', 'TEST_MAPPED'], { TEST_KEY_A: 'TEST_MAPPED' });
    expect(env.TEST_MAPPED).toBe('original');
  });

  test('skips mapping when source key is not in env', () => {
    const env = buildSafeEnv(['TEST_KEY_A'], { NONEXISTENT: 'TEST_KEY_A' });
    expect(env.TEST_KEY_A).toBe('value-a');
    // No extra keys added from missing source
    expect(Object.keys(env)).toEqual(['TEST_KEY_A']);
  });

  test('runs postProcess callback', () => {
    const env = buildSafeEnv(['TEST_KEY_A'], undefined, (e) => {
      e.INJECTED = 'post-processed';
    });
    expect(env.INJECTED).toBe('post-processed');
    expect(env.TEST_KEY_A).toBe('value-a');
  });

  test('returns empty object with no matching keys and no mappings', () => {
    const env = buildSafeEnv([]);
    expect(env).toEqual({});
  });
});
