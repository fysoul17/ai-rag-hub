import { EmbeddingProviderName } from '@autonomy/shared';
import type { EmbeddingProviderInstance } from './types.ts';

const DEFAULT_DIMENSIONS = 1024;

/** Generate a deterministic vector from text via simple hash. */
export function hashToVector(text: string, dimensions: number): number[] {
  const vector: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    let hash = 0;
    const seed = text + String(i);
    for (let j = 0; j < seed.length; j++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(j)) | 0;
    }
    vector.push(Math.sin(hash));
  }
  return vector;
}

export class StubEmbeddingProvider implements EmbeddingProviderInstance {
  readonly name = EmbeddingProviderName.STUB;
  readonly dimensions: number;

  constructor(dimensions = DEFAULT_DIMENSIONS) {
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => hashToVector(text, this.dimensions));
  }
}
