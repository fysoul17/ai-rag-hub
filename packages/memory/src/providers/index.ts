import type { VectorProvider } from '@autonomy/shared';
import { VectorProviderError } from '../errors.ts';
import { LanceDBProvider } from './lancedb.ts';
import type { VectorStore } from './types.ts';

const providers = new Map<string, VectorStore>();

export function registerProvider(provider: VectorStore): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: VectorProvider): VectorStore {
  const provider = providers.get(name);
  if (!provider) {
    throw new VectorProviderError(
      name,
      `Not registered. Available: ${[...providers.keys()].join(', ')}`,
    );
  }
  return provider;
}

// Register built-in providers
registerProvider(new LanceDBProvider());

export { LanceDBProvider } from './lancedb.ts';
export type { VectorFilter, VectorSearchResult, VectorStore, VectorStoreConfig } from './types.ts';
