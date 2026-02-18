import type { MemoryInterface } from '@autonomy/memory';
import { getSupportedExtensions, IngestionPipeline } from '@autonomy/memory';
import { type MemoryIngestRequest, type MemorySearchParams, MemoryType } from '@autonomy/shared';
import { BadRequestError } from '../errors.ts';
import { jsonResponse, parseJsonBody } from '../middleware.ts';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const VALID_MEMORY_TYPES = new Set<string>([MemoryType.SHORT_TERM, MemoryType.LONG_TERM]);

function validateMemoryType(value: string | null | undefined): MemoryType | undefined {
  if (value == null) return undefined;
  if (!VALID_MEMORY_TYPES.has(value)) {
    throw new BadRequestError(
      `Invalid type: must be "${MemoryType.SHORT_TERM}" or "${MemoryType.LONG_TERM}"`,
    );
  }
  return value as MemoryType;
}

export function createMemoryRoutes(memory: MemoryInterface) {
  return {
    search: async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const query = url.searchParams.get('query');
      if (!query) throw new BadRequestError('query parameter is required');

      const limitParam = url.searchParams.get('limit');
      const params: MemorySearchParams = {
        query,
        limit: limitParam !== null ? parseInt(limitParam, 10) : undefined,
        type: validateMemoryType(url.searchParams.get('type')),
        agentId: url.searchParams.get('agentId') ?? undefined,
      };

      const results = await memory.search(params);
      return jsonResponse(results);
    },

    ingest: async (req: Request): Promise<Response> => {
      const body = await parseJsonBody<MemoryIngestRequest>(req);

      if (!body.content) {
        throw new BadRequestError('content is required');
      }

      const entry = await memory.store({
        content: body.content,
        type: validateMemoryType(body.type) ?? MemoryType.LONG_TERM,
        metadata: body.metadata ?? {},
      });

      return jsonResponse(entry, 201);
    },

    stats: async (): Promise<Response> => {
      const stats = await memory.stats();
      return jsonResponse(stats);
    },

    ingestFile: async (req: Request): Promise<Response> => {
      const contentType = req.headers.get('content-type') ?? '';
      if (!contentType.includes('multipart/form-data')) {
        throw new BadRequestError('Content-Type must be multipart/form-data');
      }

      const formData = await req.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        throw new BadRequestError('Missing "file" field in form data');
      }

      if (file.size === 0) {
        throw new BadRequestError('File is empty');
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestError(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      }

      // Validate file extension server-side
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const supported = getSupportedExtensions();
      if (!supported.includes(ext)) {
        throw new BadRequestError(
          `Unsupported file type "${ext}". Supported: ${supported.join(', ')}`,
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const result = await IngestionPipeline.ingest(buffer, file.name, memory);

      return jsonResponse(
        {
          filename: result.filename,
          chunks: result.chunks,
          totalCharacters: result.totalCharacters,
        },
        201,
      );
    },
  };
}
