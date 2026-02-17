import type { Memory } from '@autonomy/memory';
import { IngestionPipeline } from '@autonomy/memory';
import { BadRequestError } from '../errors.ts';
import { errorResponse, jsonResponse } from '../middleware.ts';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.log', '.csv', '.tsv', '.pdf', '.docx']);

function validateFilename(filename: string): string {
  // Sanitize: strip path components to prevent path traversal
  const basename = filename.replace(/^.*[\\/]/, '');
  if (!basename || basename.startsWith('.')) {
    throw new BadRequestError('Invalid filename');
  }
  const ext = basename.slice(basename.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestError(
      `Unsupported file type "${ext}". Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
    );
  }
  return basename;
}

export function createFileIngestRoute(memory: Memory) {
  return async (req: Request): Promise<Response> => {
    try {
      const contentType = req.headers.get('content-type') ?? '';
      if (!contentType.includes('multipart/form-data')) {
        throw new BadRequestError('Expected multipart/form-data');
      }

      const formData = await req.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        throw new BadRequestError('Missing "file" field in form data');
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestError(
          `File too large (${file.size} bytes). Maximum: ${MAX_FILE_SIZE} bytes`,
        );
      }

      if (file.size === 0) {
        throw new BadRequestError('File is empty');
      }

      const sanitizedName = validateFilename(file.name);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const result = await IngestionPipeline.ingest(buffer, sanitizedName, memory);

      return jsonResponse(result);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
