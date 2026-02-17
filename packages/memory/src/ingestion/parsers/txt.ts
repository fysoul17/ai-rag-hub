import type { FileParser } from '../types.ts';

export const txtParser: FileParser = {
  extensions: ['.txt', '.md', '.markdown', '.log'],
  async parse(buffer: Buffer, _filename: string): Promise<string> {
    return buffer.toString('utf-8');
  },
};
