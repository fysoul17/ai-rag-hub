import type { ChunkingOptions } from './types.ts';

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 200;

export function chunkText(text: string, options: ChunkingOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.chunkOverlap ?? DEFAULT_OVERLAP;
  const separator = options.separator ?? '\n';

  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split(separator);
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 1 > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const overlapText = current.slice(-overlap);
      current = overlapText + separator + para;
    } else {
      current += (current ? separator : '') + para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}
