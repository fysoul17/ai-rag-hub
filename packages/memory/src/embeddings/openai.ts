import { EmbeddingProviderName } from '@autonomy/shared';
import { EmbeddingError } from '../errors.ts';
import type { EmbeddingProviderConfig, EmbeddingProviderInstance } from './types.ts';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';

interface OpenAIResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

export class OpenAIEmbeddingProvider implements EmbeddingProviderInstance {
  readonly name = EmbeddingProviderName.OPENAI;
  readonly dimensions: number;
  private apiKey: string;
  private model: string;

  constructor(config: EmbeddingProviderConfig) {
    if (!config.apiKey) {
      throw new EmbeddingError('OpenAI embedding provider requires an API key');
    }
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.dimensions = config.dimensions ?? DEFAULT_DIMENSIONS;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: texts,
          model: this.model,
          dimensions: this.dimensions,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new EmbeddingError(
          `OpenAI API error (${response.status}): ${errorText}`,
        );
      }

      const data = (await response.json()) as OpenAIResponse;
      // Sort by index to ensure correct ordering
      return data.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    } catch (error) {
      if (error instanceof EmbeddingError) throw error;
      throw new EmbeddingError(
        `OpenAI embedding failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
