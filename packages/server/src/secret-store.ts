import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Logger } from '@autonomy/shared';

/** API key env vars that SecretStore is allowed to manage. */
const MANAGED_KEYS = new Set([
  'ANTHROPIC_API_KEY',
  'CODEX_API_KEY',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'PI_API_KEY',
]);

/**
 * Persists AI provider API keys to disk so they survive container restarts.
 *
 * Precedence:
 *  1. Env vars from docker-compose (highest — never overwritten)
 *  2. secrets.json (loaded only if env var is unset)
 *  3. Dashboard runtime input (stored to both process.env + secrets.json)
 */
export class SecretStore {
  private filePath: string;
  private logger: Logger;

  constructor(dataDir: string) {
    this.filePath = join(dataDir, 'secrets.json');
    this.logger = new Logger({ level: 'info', context: { source: 'secret-store' } });
  }

  /** Load persisted secrets into process.env (existing env vars take precedence). */
  initialize(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      const secrets = JSON.parse(raw) as Record<string, string>;

      for (const [key, value] of Object.entries(secrets)) {
        if (!MANAGED_KEYS.has(key)) continue;
        // Env vars from docker-compose take precedence
        if (!process.env[key] && typeof value === 'string' && value.length > 0) {
          process.env[key] = value;
        }
      }

      this.logger.info('Secrets loaded from disk');
    } catch {
      this.logger.warn('Corrupt secrets.json — starting fresh');
    }
  }

  /** Persist or remove a single API key. */
  set(envVar: string, value: string | null | undefined): void {
    if (!MANAGED_KEYS.has(envVar)) return;

    const secrets = this.load();

    if (value && typeof value === 'string' && value.length > 0) {
      secrets[envVar] = value;
    } else {
      delete secrets[envVar];
    }

    this.persist(secrets);
  }

  /** Remove primary + alt env var keys for a backend (e.g. CODEX_API_KEY + OPENAI_API_KEY). */
  removeBackendKeys(envVar: string, altEnvVar?: string): void {
    const secrets = this.load();
    let changed = false;

    if (MANAGED_KEYS.has(envVar) && envVar in secrets) {
      delete secrets[envVar];
      changed = true;
    }
    if (altEnvVar && MANAGED_KEYS.has(altEnvVar) && altEnvVar in secrets) {
      delete secrets[altEnvVar];
      changed = true;
    }

    if (changed) {
      this.persist(secrets);
    }
  }

  private load(): Record<string, string> {
    if (!existsSync(this.filePath)) return {};
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8'));
    } catch {
      return {};
    }
  }

  private persist(secrets: Record<string, string>): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.filePath, JSON.stringify(secrets, null, 2));
    chmodSync(this.filePath, 0o600);
  }
}
