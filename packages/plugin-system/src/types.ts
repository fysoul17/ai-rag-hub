/**
 * Plugin system type definitions.
 *
 * Defines the contract for hooks, middleware, and plugin lifecycle.
 */

// ---- Hook Types ----

// Re-export HookName from shared as HookType.
// This ensures plugins register with the same string values that the
// conductor and agent-pool emit, so hooks actually fire.
import { HookName } from '@autonomy/shared';

export const HookType = HookName;
export type HookType = (typeof HookType)[keyof typeof HookType];

// Re-export shared types so consumers can import from plugin-system
export type { HookHandler, HookRegistryInterface } from '@autonomy/shared';

import type { HookHandler, HookRegistryInterface } from '@autonomy/shared';

// ---- Hook Registration ----

export interface HookRegistration {
  /** The hook type this handler is registered for. */
  hookType: string;
  /** The handler function. */
  handler: HookHandler;
  /** Lower numbers execute first. Default: 100. */
  priority: number;
  /** The plugin that registered this hook (for cleanup). */
  pluginId?: string;
}

// ---- Middleware ----

export type Middleware<TContext = Record<string, unknown>> = (
  ctx: TContext,
  next: () => Promise<void>,
) => Promise<void>;

// ---- Plugin Definition ----

export interface PluginDefinition {
  /** Unique plugin name. */
  name: string;
  /** Semantic version string. */
  version: string;
  /** Optional description. */
  description?: string;
  /** Called when the plugin is loaded. */
  initialize?: (registry: HookRegistryInterface) => void | Promise<void>;
  /** Called when the plugin is unloaded. */
  shutdown?: () => void | Promise<void>;
  /** Declarative hook registrations (alternative to initialize). */
  hooks?: Array<{
    hookType: HookType;
    handler: HookHandler;
    priority?: number;
  }>;
  /** Declarative middleware registrations. */
  middleware?: Array<{
    name: string;
    handler: Middleware;
    priority?: number;
  }>;
}

export type PluginStatus = 'loaded' | 'error' | 'unloaded';

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  status: PluginStatus;
  hookCount: number;
}
