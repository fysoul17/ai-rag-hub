import { MemoryType } from '@autonomy/shared';
import { MemoryError } from '../errors.ts';
import type { MemoryInterface } from '../memory-interface.ts';
import { chunkText } from './chunker.ts';
import { getParser } from './parsers/index.ts';
import type { ChunkingOptions, IngestionResult } from './types.ts';

const STORE_BATCH_SIZE = 10;

async function ingest(
  buffer: Buffer,
  filename: string,
  memory: MemoryInterface,
  options: ChunkingOptions = {},
): Promise<IngestionResult> {
  if (!buffer || buffer.length === 0) {
    throw new MemoryError(`Empty file: ${filename}`);
  }

  const parser = getParser(filename);
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

  const text = await parser.parse(buffer, filename);
  if (!text || text.trim().length === 0) {
    throw new MemoryError(`No text content extracted from file: ${filename}`);
  }

  const chunks = chunkText(text, options).filter((c): c is string => !!c);
  const totalChunks = chunks.length;
  const entryIds: string[] = [];
  let totalCharacters = 0;

  // Store chunks in batches to reduce sequential overhead
  for (let batchStart = 0; batchStart < chunks.length; batchStart += STORE_BATCH_SIZE) {
    const batch = chunks.slice(batchStart, batchStart + STORE_BATCH_SIZE);
    const storePromises = batch.map((chunk, idx) => {
      totalCharacters += chunk.length;
      return memory.store({
        content: chunk,
        type: MemoryType.LONG_TERM,
        metadata: {
          source: filename,
          chunkIndex: batchStart + idx,
          totalChunks,
        },
      });
    });

    const entries = await Promise.all(storePromises);
    for (const entry of entries) {
      entryIds.push(entry.id);
    }
  }

  return {
    filename,
    fileType: ext,
    chunks: totalChunks,
    entryIds,
    totalCharacters,
  };
}

export const IngestionPipeline = { ingest } as const;
