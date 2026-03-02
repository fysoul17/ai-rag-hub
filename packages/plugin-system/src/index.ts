/**
 * @autonomy/plugin-system — Event hook system, middleware pipeline, plugin lifecycle.
 */

export {
  DuplicatePluginError,
  PluginError,
  PluginNotFoundError,
} from './errors.ts';
export { HookRegistry } from './hook-registry.ts';
export { PluginManager } from './plugin-manager.ts';

export type {
  HookHandler,
  HookRegistration,
  HookRegistryInterface,
  Middleware,
  PluginDefinition,
  PluginInfo,
  PluginStatus,
} from './types.ts';
