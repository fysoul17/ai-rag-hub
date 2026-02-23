import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SecretStore } from '../src/secret-store.ts';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `secret-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  // Clean up any env vars we may have set
  for (const key of [
    'ANTHROPIC_API_KEY',
    'CODEX_API_KEY',
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_API_KEY',
  ]) {
    delete process.env[key];
  }
});

describe('SecretStore.initialize', () => {
  test('returns early when no secrets.json exists', () => {
    const store = new SecretStore(testDir);
    // Should not throw
    store.initialize();
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  test('loads keys from secrets.json into process.env', () => {
    writeFileSync(
      join(testDir, 'secrets.json'),
      JSON.stringify({ ANTHROPIC_API_KEY: 'sk-ant-persisted-key-12345' }),
    );

    const store = new SecretStore(testDir);
    store.initialize();

    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-persisted-key-12345');
  });

  test('does not overwrite existing env vars (docker-compose takes precedence)', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-from-docker-compose';
    writeFileSync(
      join(testDir, 'secrets.json'),
      JSON.stringify({ ANTHROPIC_API_KEY: 'sk-ant-from-secrets-json' }),
    );

    const store = new SecretStore(testDir);
    store.initialize();

    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-from-docker-compose');
  });

  test('ignores non-managed keys in secrets.json', () => {
    writeFileSync(
      join(testDir, 'secrets.json'),
      JSON.stringify({ RANDOM_SECRET: 'should-not-load' }),
    );

    const store = new SecretStore(testDir);
    store.initialize();

    expect(process.env.RANDOM_SECRET).toBeUndefined();
  });

  test('handles corrupt secrets.json gracefully', () => {
    writeFileSync(join(testDir, 'secrets.json'), '{corrupt json!!!');

    const store = new SecretStore(testDir);
    // Should not throw
    store.initialize();
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  test('skips empty string values', () => {
    writeFileSync(
      join(testDir, 'secrets.json'),
      JSON.stringify({ ANTHROPIC_API_KEY: '' }),
    );

    const store = new SecretStore(testDir);
    store.initialize();

    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  test('loads multiple keys', () => {
    writeFileSync(
      join(testDir, 'secrets.json'),
      JSON.stringify({
        ANTHROPIC_API_KEY: 'sk-ant-key-1234',
        CODEX_API_KEY: 'sk-codex-key-5678',
        GEMINI_API_KEY: 'gemini-key-9012',
      }),
    );

    const store = new SecretStore(testDir);
    store.initialize();

    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-key-1234');
    expect(process.env.CODEX_API_KEY).toBe('sk-codex-key-5678');
    expect(process.env.GEMINI_API_KEY).toBe('gemini-key-9012');
  });
});

describe('SecretStore.set', () => {
  test('persists a key to disk', () => {
    const store = new SecretStore(testDir);
    store.set('ANTHROPIC_API_KEY', 'sk-ant-new-key-00000');

    const file = JSON.parse(readFileSync(join(testDir, 'secrets.json'), 'utf-8'));
    expect(file.ANTHROPIC_API_KEY).toBe('sk-ant-new-key-00000');
  });

  test('removes a key when value is null', () => {
    writeFileSync(
      join(testDir, 'secrets.json'),
      JSON.stringify({ ANTHROPIC_API_KEY: 'sk-ant-old-key' }),
    );

    const store = new SecretStore(testDir);
    store.set('ANTHROPIC_API_KEY', null);

    const file = JSON.parse(readFileSync(join(testDir, 'secrets.json'), 'utf-8'));
    expect(file.ANTHROPIC_API_KEY).toBeUndefined();
  });

  test('removes a key when value is empty string', () => {
    writeFileSync(
      join(testDir, 'secrets.json'),
      JSON.stringify({ ANTHROPIC_API_KEY: 'sk-ant-old-key' }),
    );

    const store = new SecretStore(testDir);
    store.set('ANTHROPIC_API_KEY', '');

    const file = JSON.parse(readFileSync(join(testDir, 'secrets.json'), 'utf-8'));
    expect(file.ANTHROPIC_API_KEY).toBeUndefined();
  });

  test('ignores non-managed keys', () => {
    const store = new SecretStore(testDir);
    store.set('RANDOM_KEY', 'should-not-persist');

    expect(existsSync(join(testDir, 'secrets.json'))).toBe(false);
  });

  test('preserves other keys when setting one', () => {
    writeFileSync(
      join(testDir, 'secrets.json'),
      JSON.stringify({ CODEX_API_KEY: 'sk-codex-existing' }),
    );

    const store = new SecretStore(testDir);
    store.set('ANTHROPIC_API_KEY', 'sk-ant-new-key-00000');

    const file = JSON.parse(readFileSync(join(testDir, 'secrets.json'), 'utf-8'));
    expect(file.CODEX_API_KEY).toBe('sk-codex-existing');
    expect(file.ANTHROPIC_API_KEY).toBe('sk-ant-new-key-00000');
  });

  test('sets file permissions to 0o600', () => {
    const store = new SecretStore(testDir);
    store.set('ANTHROPIC_API_KEY', 'sk-ant-secure-key-000');

    const stats = statSync(join(testDir, 'secrets.json'));
    // 0o600 = owner read/write only (33152 in decimal on most systems)
    expect(stats.mode & 0o777).toBe(0o600);
  });

  test('creates secrets.json on first set', () => {
    expect(existsSync(join(testDir, 'secrets.json'))).toBe(false);

    const store = new SecretStore(testDir);
    store.set('GEMINI_API_KEY', 'gemini-new-key-12345');

    expect(existsSync(join(testDir, 'secrets.json'))).toBe(true);
    const file = JSON.parse(readFileSync(join(testDir, 'secrets.json'), 'utf-8'));
    expect(file.GEMINI_API_KEY).toBe('gemini-new-key-12345');
  });
});

describe('SecretStore.removeBackendKeys', () => {
  test('removes primary key from secrets.json', () => {
    writeFileSync(
      join(testDir, 'secrets.json'),
      JSON.stringify({ CODEX_API_KEY: 'sk-codex-key' }),
    );

    const store = new SecretStore(testDir);
    store.removeBackendKeys('CODEX_API_KEY');

    const file = JSON.parse(readFileSync(join(testDir, 'secrets.json'), 'utf-8'));
    expect(file.CODEX_API_KEY).toBeUndefined();
  });

  test('removes primary + alt key from secrets.json', () => {
    writeFileSync(
      join(testDir, 'secrets.json'),
      JSON.stringify({ CODEX_API_KEY: 'sk-codex-key', OPENAI_API_KEY: 'sk-openai-key' }),
    );

    const store = new SecretStore(testDir);
    store.removeBackendKeys('CODEX_API_KEY', 'OPENAI_API_KEY');

    const file = JSON.parse(readFileSync(join(testDir, 'secrets.json'), 'utf-8'));
    expect(file.CODEX_API_KEY).toBeUndefined();
    expect(file.OPENAI_API_KEY).toBeUndefined();
  });

  test('no-op when keys not in secrets.json', () => {
    const store = new SecretStore(testDir);
    // Should not throw, and should not create the file
    store.removeBackendKeys('CODEX_API_KEY', 'OPENAI_API_KEY');
    expect(existsSync(join(testDir, 'secrets.json'))).toBe(false);
  });

  test('preserves unrelated keys', () => {
    writeFileSync(
      join(testDir, 'secrets.json'),
      JSON.stringify({
        ANTHROPIC_API_KEY: 'sk-ant-keep-this',
        CODEX_API_KEY: 'sk-codex-remove',
      }),
    );

    const store = new SecretStore(testDir);
    store.removeBackendKeys('CODEX_API_KEY');

    const file = JSON.parse(readFileSync(join(testDir, 'secrets.json'), 'utf-8'));
    expect(file.ANTHROPIC_API_KEY).toBe('sk-ant-keep-this');
    expect(file.CODEX_API_KEY).toBeUndefined();
  });
});
