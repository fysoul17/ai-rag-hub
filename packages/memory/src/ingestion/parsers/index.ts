import { MemoryError } from '../../errors.ts';
import type { FileParser } from '../types.ts';
import { csvParser } from './csv.ts';
import { docxParser } from './docx.ts';
import { pdfParser } from './pdf.ts';
import { txtParser } from './txt.ts';

const parsers: FileParser[] = [txtParser, csvParser, pdfParser, docxParser];

const extensionMap = new Map<string, FileParser>();
for (const parser of parsers) {
  for (const ext of parser.extensions) {
    extensionMap.set(ext, parser);
  }
}

export function getParser(filename: string): FileParser {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  const parser = extensionMap.get(ext);
  if (!parser) {
    throw new MemoryError(
      `Unsupported file type "${ext}". Supported: ${[...extensionMap.keys()].join(', ')}`,
    );
  }
  return parser;
}

export function getSupportedExtensions(): string[] {
  return [...extensionMap.keys()];
}
