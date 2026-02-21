'use client';

import '@xterm/xterm/css/xterm.css';
import { Copy, ExternalLink, LogIn, RefreshCw, RotateCcw, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { logoutClaudeBackend } from '@/lib/api';

type LoginState = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

interface ClaudeLoginTerminalProps {
  /** Whether the user is already authenticated via CLI login. */
  isAuthenticated?: boolean;
  onComplete?: () => void;
}

const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL ?? 'http://localhost:7820';
const WS_TERMINAL_URL = `${RUNTIME_URL.replace(/^http/, 'ws')}/ws/terminal`;

/** Trusted domains for login URLs. */
const TRUSTED_LOGIN_DOMAINS = new Set([
  'console.anthropic.com',
  'anthropic.com',
  'claude.ai',
  'platform.claude.com',
  'accounts.google.com',
  'github.com',
  'login.microsoftonline.com',
]);

const URL_REGEX = /https?:\/\/[^\s"'<>\x1b]+/g;

/** Extract trusted login URLs from text (strips ANSI codes first). */
function extractAuthUrl(text: string): string | null {
  // Strip ANSI escape sequences before matching
  const clean = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  const matches = clean.match(URL_REGEX);
  if (!matches) return null;
  for (const url of matches) {
    try {
      if (TRUSTED_LOGIN_DOMAINS.has(new URL(url).hostname)) {
        return url;
      }
    } catch {
      // Malformed URL — skip
    }
  }
  return null;
}

/**
 * Xterm.js-based terminal that connects to the server's PTY via WebSocket.
 * The CLI gets a real TTY so interactive prompts (including auth code input) work.
 */
function XtermTerminal({
  onExit,
  onUrlDetected,
}: {
  onExit: (exitCode: number | null) => void;
  onUrlDetected: (url: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let disposed = false;

    (async () => {
      // Dynamic import to avoid SSR issues
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        theme: {
          background: '#0a0a0a',
          foreground: '#e5e5e5',
          cursor: '#e5e5e5',
          selectionBackground: '#3b82f680',
        },
        rows: 14,
        cols: 80,
        convertEol: true,
        scrollback: 500,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();
      term.focus();
      termRef.current = term;

      // Connect WebSocket to server PTY
      const ws = new WebSocket(WS_TERMINAL_URL);
      wsRef.current = ws;

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        term.write('\x1b[90m$ claude auth login\x1b[0m\r\n');
      };

      ws.onmessage = (event) => {
        let text: string;
        if (event.data instanceof ArrayBuffer) {
          const bytes = new Uint8Array(event.data);
          term.write(bytes);
          text = new TextDecoder().decode(bytes);
        } else {
          term.write(event.data);
          text = event.data;
        }
        // Detect auth URL in output
        const url = extractAuthUrl(text);
        if (url) onUrlDetected(url);
      };

      ws.onclose = () => {
        if (!disposed) {
          onExit(0);
        }
      };

      ws.onerror = () => {
        term.write('\r\n\x1b[31mWebSocket connection failed\x1b[0m\r\n');
        onExit(1);
      };

      // Forward user keystrokes (including paste) to server PTY.
      // xterm.js natively handles paste via browser paste events and fires
      // onData with the pasted text — no custom handler needed.
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // Handle resize
      const observer = new ResizeObserver(() => {
        fitAddon.fit();
      });
      observer.observe(containerRef.current);
    })();

    return () => {
      disposed = true;
      wsRef.current?.close();
      wsRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, [onExit, onUrlDetected]);

  return (
    <div
      ref={containerRef}
      className="rounded-md overflow-hidden border border-border/50 cursor-text"
      style={{ height: '260px' }}
      onClick={() => termRef.current?.focus()}
    />
  );
}

/** Clickable auth URL link with copy button. */
function AuthUrlLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback: select text
    });
  }, [url]);

  return (
    <div className="flex items-center gap-2 rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2">
      <ExternalLink className="h-3 w-3 shrink-0 text-blue-400" />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 truncate min-w-0"
      >
        Open login page
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 text-blue-400 hover:text-blue-300 transition-colors"
        title="Copy URL"
      >
        <Copy className="h-3 w-3" />
      </button>
      {copied && <span className="text-[10px] text-blue-300 shrink-0">Copied!</span>}
    </div>
  );
}

export function ClaudeLoginTerminal({ isAuthenticated, onComplete }: ClaudeLoginTerminalProps) {
  const [state, setState] = useState<LoginState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  const handleExit = useCallback(
    (exitCode: number | null) => {
      setState(exitCode === 0 ? 'success' : 'error');
      if (exitCode !== 0 && exitCode !== null) {
        setErrorMessage(`Process exited with code ${exitCode}`);
      }
      onComplete?.();
    },
    [onComplete],
  );

  const handleUrlDetected = useCallback((url: string) => {
    setAuthUrl(url);
  }, []);

  const doLogoutFirst = useCallback(async () => {
    try {
      await logoutClaudeBackend();
    } catch {
      // Ignore logout errors
    }
  }, []);

  const handleStart = useCallback(async () => {
    setErrorMessage(null);
    setAuthUrl(null);
    if (isAuthenticated) await doLogoutFirst();
    setState('running');
  }, [doLogoutFirst, isAuthenticated]);

  const handleCancel = useCallback(() => {
    setState('cancelled');
  }, []);

  if (state === 'idle') {
    return (
      <Button variant="outline" size="sm" className="w-full text-xs" onClick={handleStart}>
        {isAuthenticated ? (
          <>
            <RefreshCw className="mr-1 h-3 w-3" />
            Switch Account
          </>
        ) : (
          <>
            <LogIn className="mr-1 h-3 w-3" />
            Login with Claude
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {/* Clickable auth URL (blue link) */}
      {state === 'running' && authUrl && <AuthUrlLink url={authUrl} />}

      {/* Real PTY terminal via xterm.js */}
      {state === 'running' && (
        <XtermTerminal onExit={handleExit} onUrlDetected={handleUrlDetected} />
      )}

      {/* Hint */}
      {state === 'running' && authUrl && (
        <p className="text-[10px] text-muted-foreground">
          A browser window should open automatically. If not, click the link above.
        </p>
      )}

      {/* Status messages */}
      {state === 'success' && (
        <div className="text-xs text-green-400" role="alert">
          Login completed successfully.
        </div>
      )}
      {state === 'error' && (
        <div className="text-xs text-red-400" role="alert">
          {errorMessage ?? 'Login failed.'}
        </div>
      )}
      {state === 'cancelled' && (
        <output className="block text-xs text-muted-foreground">Login cancelled.</output>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {state === 'running' ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs text-red-400 hover:text-red-300"
            onClick={handleCancel}
          >
            <Square className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={handleStart}>
            <RotateCcw className="mr-1 h-3 w-3" />
            {state === 'success' ? 'Login Again' : 'Retry'}
          </Button>
        )}
      </div>
    </div>
  );
}
