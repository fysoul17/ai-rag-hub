import { EmbeddingProviderName } from '@autonomy/shared';
import { EmbeddingError } from '../errors.ts';
import type { EmbeddingProviderConfig, EmbeddingProviderInstance } from './types.ts';

const DEFAULT_MODEL = 'voyage-3';
const DEFAULT_DIMENSIONS = 1024;
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';

interface VoyageResponse {
  data: Array<{ embedding: number[] }>;
  usage: { total_tokens: number };
}

export class AnthropicEmbeddingProvider implements EmbeddingProviderInstance {
  readonly name = EmbeddingProviderName.ANTHROPIC;
  readonly dimensions: number;
  private apiKey: string;
  private model: string;

  constructor(config: EmbeddingProviderConfig) {
    if (!config.apiKey) {
      throw new EmbeddingError('Anthropic (Voyage) embedding provider requires an API key');
    }
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.dimensions = config.dimensions ?? DEFAULT_DIMENSIONS;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
      const response = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: texts,
          model: this.model,
          output_dimension: this.dimensions,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new EmbeddingError(
          `Voyage API error (${response.status}): ${errorText}`,
        );
      }

      const data = (await response.json()) as VoyageResponse;
      return data.data.map((d) => d.embedding);
    } catch (error) {
      if (error instanceof EmbeddingError) throw error;
      throw new EmbeddingError(
        `Anthropic embedding failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
