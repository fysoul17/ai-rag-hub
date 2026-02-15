/**
 * MockEmbedder — deterministic embedding function for tests.
 *
 * Generates fake vectors based on content hash so that:
 * - Same content always produces the same vector
 * - Different content produces different vectors
 */
import type { EmbeddingProvider } from '../../src/rag/types.ts';

const DEFAULT_DIMENSIONS = 8;

/** Generate a deterministic vector for a single text string. */
function hashToVector(text: string, dimensions: number): number[] {
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

/** Creates a deterministic mock embedder (batch signature). */
export function createMockEmbedder(dimensions: number = DEFAULT_DIMENSIONS): EmbeddingProvider {
  return async (texts: string[]): Promise<number[][]> => {
    return texts.map((text) => hashToVector(text, dimensions));
  };
}

/** Creates a mock embedder that always throws. */
export function createFailingEmbedder(error: Error): EmbeddingProvider {
  return async (_texts: string[]): Promise<number[][]> => {
    throw error;
  };
}

/** Creates a mock embedder that returns a fixed vector for every input. */
export function createFixedEmbedder(vector: number[]): EmbeddingProvider {
  return async (texts: string[]): Promise<number[][]> => {
    return texts.map(() => [...vector]);
  };
}
