import {
  AIBackend,
  BACKEND_CAPABILITIES,
  type BackendStatus,
  Logger,
  type StreamEvent,
} from '@autonomy/shared';
import { BackendError } from '../errors.ts';
import type { BackendProcess, BackendSpawnConfig, CLIBackend } from './types.ts';

const claudeLogger = new Logger({ context: { source: 'claude-backend' } });

/** Max bytes to read from stderr to prevent unbounded memory usage. */
const MAX_STDERR_BYTES = 4096;

/** Read stderr with a size cap. Returns at most MAX_STDERR_BYTES of text. */
async function readBoundedStderr(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (totalBytes < MAX_STDERR_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder()
    .decode(chunks.length === 1 ? chunks[0] : Buffer.concat(chunks))
    .slice(0, MAX_STDERR_BYTES);
}

/** Mask an API key: show only last 4 chars. Returns undefined for short/missing keys. */
function maskApiKey(key: string | undefined): string | undefined {
  if (!key || key.length < 12) return undefined;
  return `sk-...${key.slice(-4)}`;
}

/** Env vars allowlisted for child processes. Only forward what claude CLI needs. */
const ALLOWED_ENV_KEYS = [
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'NODE_ENV',
  'ANTHROPIC_API_KEY',
  // XDG dirs — needed for CLI to find auth credentials on Linux
  'XDG_RUNTIME_DIR',
  'XDG_DATA_HOME',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
  // macOS-specific
  'DISPLAY',
];

function buildSafeEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ALLOWED_ENV_KEYS) {
    const val = process.env[key];
    if (val !== undefined) env[key] = val;
  }
  // Forward CLAUDE_* env vars but exclude vars that block nested sessions
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith('CLAUDE_') && val !== undefined) {
      env[key] = val;
    }
  }
  // Never forward CLAUDECODE — it prevents the CLI from launching as a child process
  delete env.CLAUDECODE;
  return env;
}

class ClaudeProcess implements BackendProcess {
  private _alive = true;
  private _process: ReturnType<typeof Bun.spawn> | null = null;
  private config: BackendSpawnConfig;

  constructor(config: BackendSpawnConfig) {
    this.config = config;
  }

  get alive(): boolean {
    return this._alive;
  }

  async send(message: string): Promise<string> {
    if (!this._alive) {
      throw new BackendError('claude', 'Process is not alive');
    }

    const args = this.buildArgs(message);
    const env = buildSafeEnv();

    this._process = Bun.spawn(['claude', ...args], {
      cwd: this.config.cwd ?? process.cwd(),
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stdoutStream = this._process.stdout as ReadableStream;
    const stderrStream = this._process.stderr as ReadableStream;

    const [stdout, _stderr, exitCode] = await Promise.all([
      new Response(stdoutStream).text(),
      new Response(stderrStream).text(),
      this._process.exited,
    ]);

    this._process = null;

    if (exitCode !== 0) {
      throw new BackendError('claude', `Process exited with code ${exitCode}`);
    }

    return stdout.trim();
  }

  async *sendStreaming(message: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
    if (!this._alive) {
      yield { type: 'error', error: 'Process is not alive' };
      return;
    }

    if (signal?.aborted) {
      yield { type: 'error', error: 'Aborted' };
      return;
    }

    const args = this.buildArgs(message);
    const env = buildSafeEnv();

    this._process = Bun.spawn(['claude', ...args], {
      cwd: this.config.cwd ?? process.cwd(),
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const proc = this._process;
    const stdoutStream = proc.stdout as ReadableStream;
    const stderrStream = proc.stderr as ReadableStream;
    const reader = stdoutStream.getReader();
    const decoder = new TextDecoder();

    // Read stderr in background (bounded to prevent memory issues)
    const stderrPromise = readBoundedStderr(stderrStream);

    // Abort handling: kill the process when signal fires
    const onAbort = () => {
      try {
        if (proc.exitCode === null) proc.kill();
      } catch {
        // Ignore kill errors
      }
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    let hasContent = false;

    try {
      while (true) {
        if (signal?.aborted) {
          yield { type: 'error', error: 'Aborted' };
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        if (text) {
          hasContent = true;
          yield { type: 'chunk', content: text };
        }
      }

      // Flush decoder
      const remaining = decoder.decode();
      if (remaining) {
        hasContent = true;
        yield { type: 'chunk', content: remaining };
      }

      const exitCode = await proc.exited;
      const stderrText = await stderrPromise;
      this._process = null;

      if (exitCode !== 0) {
        const stderr = stderrText.trim().slice(0, 500);
        claudeLogger.warn('Backend process failed', { exitCode, stderr });
        // Include stderr summary in error so it reaches debug console via DebugBus.
        // The websocket layer sanitizes what the chat client sees.
        yield {
          type: 'error',
          error: stderr
            ? `Backend exited with code ${exitCode}: ${stderr}`
            : `Backend process exited with code ${exitCode}`,
        };
      } else if (!hasContent && stderrText.trim()) {
        const stderr = stderrText.trim().slice(0, 500);
        claudeLogger.warn('Backend produced no output', { stderr });
        yield {
          type: 'error',
          error: `Backend produced no output: ${stderr}`,
        };
      } else {
        yield { type: 'complete' };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      yield { type: 'error', error: msg };
    } finally {
      signal?.removeEventListener('abort', onAbort);
      reader.releaseLock();
    }
  }

  async stop(): Promise<void> {
    if (this._process && this._process.exitCode === null) {
      this._process.kill();
      this._process = null;
    }
    this._alive = false;
  }

  private buildArgs(message: string): string[] {
    const args: string[] = ['-p', message];

    if (this.config.systemPrompt) {
      args.push('--system-prompt', this.config.systemPrompt);
    }
    if (this.config.tools && this.config.tools.length > 0) {
      args.push('--allowed-tools', ...this.config.tools);
    }
    if (this.config.skipPermissions !== false) {
      // Default: skip permissions (autonomous runtime in Docker sandbox)
      args.push('--dangerously-skip-permissions');
    }

    // Stateless mode: each CLI call is independent (no --session-id/--resume).
    // Multi-turn context is handled by the conductor's memory system, not CLI sessions.
    // The -p flag runs in single-shot mode which doesn't reliably persist sessions,
    // causing --resume to fail on subsequent calls.
    args.push('--no-session-persistence');

    return args;
  }
}

export class ClaudeBackend implements CLIBackend {
  readonly name = AIBackend.CLAUDE;
  readonly capabilities = BACKEND_CAPABILITIES[AIBackend.CLAUDE];

  async spawn(config: BackendSpawnConfig): Promise<BackendProcess> {
    return new ClaudeProcess(config);
  }

  async logout(): Promise<void> {
    const env = buildSafeEnv();
    const proc = Bun.spawn(['claude', 'auth', 'logout'], {
      cwd: process.cwd(),
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr as ReadableStream).text();
      throw new BackendError('claude', `Logout failed (exit ${exitCode}): ${stderr.trim()}`);
    }
  }

  /**
   * Check actual CLI login state by running `claude auth status --json`.
   * Returns true only when the JSON response contains `{"loggedIn": true}`.
   * Safe to call only when the CLI binary is known to be on PATH.
   */
  private async checkCliAuth(): Promise<boolean> {
    const env = buildSafeEnv();
    try {
      const proc = Bun.spawn(['claude', 'auth', 'status', '--json'], {
        cwd: process.cwd(),
        env,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      // Race against a 5-second timeout to avoid blocking status checks.
      // Keep a handle so we can cancel the timer if the process exits first.
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const exitCode = await Promise.race([
        proc.exited,
        new Promise<number>((resolve) => {
          timeoutHandle = setTimeout(() => {
            try {
              proc.kill();
            } catch {
              // ignore kill errors
            }
            resolve(1);
          }, 5000);
        }),
      ]);
      clearTimeout(timeoutHandle);

      if (exitCode !== 0) return false;

      const stdout = await new Response(proc.stdout as ReadableStream).text();
      const parsed = JSON.parse(stdout.trim()) as { loggedIn?: boolean };
      return parsed.loggedIn === true;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<BackendStatus> {
    // Check if claude CLI is on PATH
    const cliPath = typeof Bun !== 'undefined' ? Bun.which('claude') : null;
    const available = cliPath !== null;

    // API key takes precedence — no CLI auth check needed
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const hasApiKey = !!apiKey;

    // Check actual CLI authentication only when CLI is available and no API key is set
    const cliAuthenticated = available && !hasApiKey ? await this.checkCliAuth() : false;

    let authMode: BackendStatus['authMode'] = 'none';
    if (hasApiKey) {
      authMode = 'api_key';
    } else if (cliAuthenticated) {
      authMode = 'cli_login';
    }

    const authenticated = hasApiKey || cliAuthenticated;
    const configured = authenticated;

    return {
      name: this.name,
      available,
      configured,
      authenticated,
      apiKeyMasked: maskApiKey(apiKey),
      authMode,
      capabilities: this.capabilities,
      error: available ? undefined : 'claude CLI not found on PATH',
    };
  }
}
