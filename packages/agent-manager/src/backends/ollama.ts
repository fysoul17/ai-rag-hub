import {
  AIBackend,
  BACKEND_CAPABILITIES,
  type BackendConfigOption,
  type BackendStatus,
  Logger,
  type StreamEvent,
} from '@autonomy/shared';
import { BackendError } from '../errors.ts';
import type { BackendProcess, BackendSpawnConfig, CLIBackend } from './types.ts';

const ollamaLogger = new Logger({ context: { source: 'ollama-backend' } });

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

function getOllamaUrl(): string {
  return process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL;
}

function getDefaultModel(): string {
  return process.env.OLLAMA_MODEL || DEFAULT_MODEL;
}

/** Build the messages array for Ollama API requests. */
function buildMessages(
  systemPrompt: string | undefined,
  message: string,
): Array<{ role: 'system' | 'user'; content: string }> {
  const msgs: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (systemPrompt) {
    msgs.push({ role: 'system', content: systemPrompt });
  }
  msgs.push({ role: 'user', content: message });
  return msgs;
}

interface OllamaChatChunk {
  message?: { content?: string };
  done?: boolean;
}

/** Parse a single NDJSON line from the Ollama streaming response. */
function parseNdjsonLine(line: string): OllamaChatChunk | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as OllamaChatChunk;
  } catch {
    ollamaLogger.debug('Failed to parse NDJSON line', { line: trimmed });
    return null;
  }
}

class OllamaProcess implements BackendProcess {
  private _alive = true;
  private config: BackendSpawnConfig;
  private abortController: AbortController | null = null;

  constructor(config: BackendSpawnConfig) {
    this.config = config;
  }

  get alive(): boolean {
    return this._alive;
  }

  async send(message: string): Promise<string> {
    if (!this._alive) {
      throw new BackendError('ollama', 'Process is not alive');
    }

    const baseUrl = getOllamaUrl();
    const model = this.config.model || getDefaultModel();
    const messages = buildMessages(this.config.systemPrompt, message);

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new BackendError(
        'ollama',
        `HTTP ${response.status}: ${text.slice(0, 500) || response.statusText}`,
      );
    }

    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() ?? '';
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

    this.abortController = new AbortController();
    const onAbort = () => this.abortController?.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      yield* this.doStream(message, signal);
    } catch (error) {
      if (signal?.aborted) {
        yield { type: 'error', error: 'Aborted' };
      } else {
        yield { type: 'error', error: error instanceof Error ? error.message : String(error) };
      }
    } finally {
      signal?.removeEventListener('abort', onAbort);
      this.abortController = null;
    }
  }

  private async *doStream(message: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
    const baseUrl = getOllamaUrl();
    const model = this.config.model || getDefaultModel();
    const messages = buildMessages(this.config.systemPrompt, message);

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      yield {
        type: 'error',
        error: `HTTP ${response.status}: ${text.slice(0, 500) || response.statusText}`,
      };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    yield* this.readNdjsonStream(response.body, signal);
  }

  private async *readNdjsonStream(
    body: ReadableStream,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = '';

    try {
      while (true) {
        if (signal?.aborted) {
          yield { type: 'error', error: 'Aborted' };
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const parsed = parseNdjsonLine(line);
          if (!parsed) continue;
          if (parsed.message?.content) {
            yield { type: 'chunk', content: parsed.message.content };
          }
          if (parsed.done) {
            yield { type: 'complete' };
            return;
          }
        }
      }

      // Process remaining buffer
      if (lineBuffer.trim()) {
        const parsed = parseNdjsonLine(lineBuffer);
        if (parsed?.message?.content) {
          yield { type: 'chunk', content: parsed.message.content };
        }
      }

      yield { type: 'complete' };
    } finally {
      reader.releaseLock();
    }
  }

  async stop(): Promise<void> {
    this.abortController?.abort();
    this._alive = false;
  }
}

export class OllamaBackend implements CLIBackend {
  readonly name = AIBackend.OLLAMA;
  readonly capabilities = BACKEND_CAPABILITIES[AIBackend.OLLAMA];

  getConfigOptions(): BackendConfigOption[] {
    return [
      {
        name: 'model',
        cliFlag: '--model',
        description: 'Ollama model name (e.g., llama3.2, mistral, gemma2)',
        values: ['llama3.2', 'mistral', 'gemma2', 'qwen2.5', 'phi4'],
        defaultValue: getDefaultModel(),
      },
    ];
  }

  async spawn(config: BackendSpawnConfig): Promise<BackendProcess> {
    return new OllamaProcess(config);
  }

  async getStatus(): Promise<BackendStatus> {
    const baseUrl = getOllamaUrl();
    let available = false;
    let hasModels = false;
    let error: string | undefined;

    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        available = true;
        const data = (await response.json()) as { models?: unknown[] };
        hasModels = Array.isArray(data.models) && data.models.length > 0;
      } else {
        error = `Ollama server returned HTTP ${response.status}`;
      }
    } catch {
      error = `Ollama server not reachable at ${baseUrl}`;
    }

    let statusError: string | undefined;
    if (!available) {
      statusError = error;
    } else if (!hasModels) {
      statusError = 'No models installed (run: ollama pull llama3.2)';
    }

    return {
      name: this.name,
      available,
      configured: available && hasModels,
      authenticated: available,
      authMode: 'none',
      capabilities: this.capabilities,
      error: statusError,
    };
  }
}
