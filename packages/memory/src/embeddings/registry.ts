import type { EmbeddingProviderName } from '@autonomy/shared';
import { EmbeddingError } from '../errors.ts';
import type { EmbeddingProviderInstance } from './types.ts';

const providers = new Map<string, EmbeddingProviderInstance>();

export function registerEmbeddingProvider(provider: EmbeddingProviderInstance): void {
  providers.set(provider.name, provider);
}

export function getEmbeddingProvider(name: EmbeddingProviderName): EmbeddingProviderInstance {
  const provider = providers.get(name);
  if (!provider) {
    throw new EmbeddingError(
      `Embedding provider "${name}" not registered. Available: ${[...providers.keys()].join(', ')}`,
    );
  }
  return provider;
}

export function listEmbeddingProviders(): EmbeddingProviderName[] {
  return [...providers.keys()] as EmbeddingProviderName[];
}
