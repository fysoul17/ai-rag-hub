import type { EmbeddingProviderName } from '@autonomy/shared';

/** A pluggable embedding provider that generates vectors from text. */
export interface EmbeddingProviderInstance {
  /** Provider identifier. */
  readonly name: EmbeddingProviderName;
  /** Output vector dimensions. */
  readonly dimensions: number;
  /** Generate embeddings for one or more texts. */
  embed(texts: string[]): Promise<number[][]>;
}

/** Configuration for initializing an embedding provider. */
export interface EmbeddingProviderConfig {
  apiKey?: string;
  model?: string;
  dimensions?: number;
}
