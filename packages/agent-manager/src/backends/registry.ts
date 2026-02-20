import type { AIBackend, BackendStatus } from '@autonomy/shared';
import { BackendError } from '../errors.ts';
import type { CLIBackend } from './types.ts';

/** Registry for looking up AI backends by name. */
export interface BackendRegistry {
  /** Get a backend by name. Throws BackendError if not registered. */
  get(name: AIBackend): CLIBackend;
  /** Get the platform default backend. */
  getDefault(): CLIBackend;
  /** Get the name of the platform default backend. */
  getDefaultName(): AIBackend;
  /** Check whether a backend is registered. */
  has(name: AIBackend): boolean;
  /** List all registered backend names. */
  list(): AIBackend[];
  /** Get runtime status for all registered backends. */
  getStatusAll(): Promise<BackendStatus[]>;
}

/** Default implementation backed by a Map. */
export class DefaultBackendRegistry implements BackendRegistry {
  private backends = new Map<string, CLIBackend>();
  private defaultBackend: AIBackend;

  constructor(defaultBackend: AIBackend) {
    this.defaultBackend = defaultBackend;
  }

  /** Register a backend. Overwrites any existing backend with the same name. */
  register(backend: CLIBackend): void {
    this.backends.set(backend.name, backend);
  }

  get(name: AIBackend): CLIBackend {
    const backend = this.backends.get(name);
    if (!backend) {
      throw new BackendError(
        name,
        `Not registered. Available: ${[...this.backends.keys()].join(', ')}`,
      );
    }
    return backend;
  }

  getDefault(): CLIBackend {
    return this.get(this.defaultBackend);
  }

  getDefaultName(): AIBackend {
    return this.defaultBackend;
  }

  has(name: AIBackend): boolean {
    return this.backends.has(name);
  }

  list(): AIBackend[] {
    return [...this.backends.keys()] as AIBackend[];
  }

  async getStatusAll(): Promise<BackendStatus[]> {
    return Promise.all(
      [...this.backends.values()].map(async (backend) => {
        if (backend.getStatus) {
          return backend.getStatus();
        }
        // Fallback for backends without getStatus()
        return {
          name: backend.name,
          available: false,
          configured: false,
          authMode: 'none' as const,
          capabilities: backend.capabilities,
          error: 'Status check not implemented',
        };
      }),
    );
  }
}
