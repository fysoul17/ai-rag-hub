import type { FileParser } from '../types.ts';

export const pdfParser: FileParser = {
  extensions: ['.pdf'],
  async parse(buffer: Buffer, _filename: string): Promise<string> {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text;
  },
};
