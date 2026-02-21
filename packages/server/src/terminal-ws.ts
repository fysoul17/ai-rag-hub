/**
 * WebSocket-based PTY terminal for interactive CLI sessions.
 *
 * Uses a Python PTY bridge (pty-bridge.py) to give spawned commands a real
 * pseudo-terminal, then relays I/O over WebSocket to an xterm.js frontend.
 *
 * Protocol:
 *   Client -> Server:  raw keystrokes (binary or text)
 *   Server -> Client:  raw terminal output (binary or text)
 */
import type { ServerWebSocket } from 'bun';
import { join } from 'node:path';

export interface TerminalWSData {
  id: string;
  type: 'terminal';
}

/**
 * Env vars allowlisted for the PTY login process.
 *
 * Only forward what the CLI needs to function and open the browser for OAuth.
 * Server-side secrets (ANTHROPIC_API_KEY, AUTH_MASTER_KEY, etc.) are excluded.
 */
const PTY_ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'DISPLAY',
  'XDG_RUNTIME_DIR',
  'XDG_DATA_HOME',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
  'SSH_AUTH_SOCK',
];

function buildPtyEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of PTY_ENV_ALLOWLIST) {
    const val = process.env[key];
    if (val !== undefined) env[key] = val;
  }
  // Forward CLAUDE_* env vars (config, not secrets) but exclude CLAUDECODE
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith('CLAUDE_') && key !== 'CLAUDECODE' && val !== undefined) {
      env[key] = val;
    }
  }
  // Ensure proper terminal type for xterm.js rendering
  env.TERM = 'xterm-256color';
  return env;
}

interface PtySession {
  proc: ReturnType<typeof Bun.spawn>;
  alive: boolean;
}

const sessions = new Map<string, PtySession>();

/** 5-minute hard timeout for login PTY sessions. */
const PTY_TIMEOUT_MS = 5 * 60 * 1000;

const PTY_BRIDGE_PATH = join(import.meta.dir, 'pty-bridge.py');

export function createTerminalWebSocketHandler() {
  return {
    handler: {
      open(ws: ServerWebSocket<TerminalWSData>) {
        const env = buildPtyEnv();

        // Spawn `claude auth login` inside the PTY bridge
        const proc = Bun.spawn(
          ['python3', PTY_BRIDGE_PATH, 'claude', 'auth', 'login'],
          {
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
            env,
          },
        );

        const session: PtySession = { proc, alive: true };
        sessions.set(ws.data.id, session);

        // Stream PTY stdout -> WebSocket
        const stdoutReader = (proc.stdout as ReadableStream<Uint8Array>).getReader();
        (async () => {
          try {
            while (session.alive) {
              const { done, value } = await stdoutReader.read();
              if (done) break;
              try {
                ws.send(value);
              } catch {
                // WebSocket closed
                break;
              }
            }
          } catch {
            // Stream error
          } finally {
            stdoutReader.releaseLock();
          }

          // Process exited — send exit notification and close
          try {
            const exitCode = await proc.exited;
            const msg = `\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`;
            try {
              ws.send(new TextEncoder().encode(msg));
            } catch {
              // Already closed
            }
          } catch {
            // Ignore
          }

          session.alive = false;
          sessions.delete(ws.data.id);
          try {
            ws.close();
          } catch {
            // Already closed
          }
        })();

        // Also stream stderr -> WebSocket
        const stderrReader = (proc.stderr as ReadableStream<Uint8Array>).getReader();
        (async () => {
          try {
            while (session.alive) {
              const { done, value } = await stderrReader.read();
              if (done) break;
              try {
                ws.send(value);
              } catch {
                break;
              }
            }
          } catch {
            // Stream error
          } finally {
            stderrReader.releaseLock();
          }
        })();

        // Hard timeout
        setTimeout(() => {
          if (session.alive) {
            session.alive = false;
            try {
              proc.kill();
            } catch {
              // Ignore
            }
            try {
              const msg = '\r\n\x1b[31m[Login timed out]\x1b[0m\r\n';
              ws.send(new TextEncoder().encode(msg));
              ws.close();
            } catch {
              // Already closed
            }
            sessions.delete(ws.data.id);
          }
        }, PTY_TIMEOUT_MS);
      },

      message(ws: ServerWebSocket<TerminalWSData>, raw: string | Buffer) {
        const session = sessions.get(ws.data.id);
        if (!session?.alive) return;

        // Forward user keystrokes to PTY stdin
        try {
          const data = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
          session.proc.stdin.write(data);
          session.proc.stdin.flush();
        } catch {
          // stdin closed
        }
      },

      close(ws: ServerWebSocket<TerminalWSData>) {
        const session = sessions.get(ws.data.id);
        if (session) {
          session.alive = false;
          try {
            session.proc.kill();
          } catch {
            // Ignore
          }
          try {
            session.proc.stdin.end();
          } catch {
            // Ignore
          }
          sessions.delete(ws.data.id);
        }
      },
    },
  };
}
