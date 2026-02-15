import type { AIBackend } from '@autonomy/shared';
import { BackendError } from '../errors.ts';
import { ClaudeBackend } from './claude.ts';
import type { CLIBackend } from './types.ts';

const backends = new Map<string, CLIBackend>();

export function registerBackend(backend: CLIBackend): void {
  backends.set(backend.name, backend);
}

export function getBackend(name: AIBackend): CLIBackend {
  const backend = backends.get(name);
  if (!backend) {
    throw new BackendError(name, `Not registered. Available: ${[...backends.keys()].join(', ')}`);
  }
  return backend;
}

// Register built-in backends
registerBackend(new ClaudeBackend());

export { ClaudeBackend } from './claude.ts';
export type { BackendProcess, BackendSpawnConfig, CLIBackend } from './types.ts';
