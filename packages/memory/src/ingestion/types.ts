export interface FileParser {
  readonly extensions: string[];
  parse(buffer: Buffer, filename: string): Promise<string>;
}

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
}

export interface IngestionResult {
  filename: string;
  fileType: string;
  chunks: number;
  entryIds: string[];
  totalCharacters: number;
}
