import type { FileParser } from '../types.ts';

export const csvParser: FileParser = {
  extensions: ['.csv', '.tsv'],
  async parse(buffer: Buffer, _filename: string): Promise<string> {
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter((line) => line.trim().length > 0);

    if (lines.length === 0) return '';

    const headerLine = lines[0];
    if (!headerLine) return '';

    const delimiter = headerLine.includes('\t') ? '\t' : ',';
    const headers = parseLine(headerLine, delimiter);

    const rows: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const values = parseLine(line, delimiter);
      const parts: string[] = [];
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j]?.trim();
        const value = values[j]?.trim();
        if (header && value) {
          parts.push(`${header}: ${value}`);
        }
      }
      if (parts.length > 0) {
        rows.push(parts.join(', '));
      }
    }

    return rows.join('\n');
  },
};

function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}
