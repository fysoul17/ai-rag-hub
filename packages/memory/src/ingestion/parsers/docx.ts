import type { FileParser } from '../types.ts';

export const docxParser: FileParser = {
  extensions: ['.docx'],
  async parse(buffer: Buffer, _filename: string): Promise<string> {
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  },
};
