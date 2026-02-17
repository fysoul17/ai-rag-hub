import type { AIBackend } from '@autonomy/shared';
import { ClaudeBackend } from './claude.ts';
import { DefaultBackendRegistry } from './registry.ts';
import type { CLIBackend } from './types.ts';

// Module-level default registry (used by legacy global functions)
const defaultRegistry = new DefaultBackendRegistry('claude' as AIBackend);
defaultRegistry.register(new ClaudeBackend());

export function registerBackend(backend: CLIBackend): void {
  defaultRegistry.register(backend);
}

export function getBackend(name: AIBackend): CLIBackend {
  return defaultRegistry.get(name);
}

export { ClaudeBackend } from './claude.ts';
export { type BackendRegistry, DefaultBackendRegistry } from './registry.ts';
export type { BackendProcess, BackendSpawnConfig, CLIBackend } from './types.ts';
