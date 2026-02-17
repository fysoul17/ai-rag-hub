import type { MemoryInterface } from '@autonomy/memory';
import { type MemoryIngestRequest, type MemorySearchParams, MemoryType } from '@autonomy/shared';
import { BadRequestError } from '../errors.ts';
import { jsonResponse, parseJsonBody } from '../middleware.ts';

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
  };
}
