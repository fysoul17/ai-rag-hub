import { EmbeddingProviderName } from '@autonomy/shared';
import { EmbeddingError } from '../errors.ts';
import type { EmbeddingProviderInstance } from './types.ts';

export class LocalEmbeddingProvider implements EmbeddingProviderInstance {
  readonly name = EmbeddingProviderName.LOCAL;
  readonly dimensions = 384;

  async embed(_texts: string[]): Promise<number[][]> {
    throw new EmbeddingError(
      'Local embedding provider is not yet implemented. Use stub, anthropic, or openai instead.',
    );
  }
}
