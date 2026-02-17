import type { Memory } from '@autonomy/memory';
import { type MemoryIngestRequest, type MemorySearchParams, MemoryType, RAGStrategy } from '@autonomy/shared';
import { BadRequestError, NotFoundError } from '../errors.ts';
import { jsonResponse, parseJsonBody } from '../middleware.ts';
import type { RouteParams } from '../router.ts';

const VALID_MEMORY_TYPES = new Set<string>([MemoryType.SHORT_TERM, MemoryType.LONG_TERM]);
const VALID_RAG_STRATEGIES = new Set<string>(Object.values(RAGStrategy));

function validateMemoryType(value: string | null | undefined): MemoryType | undefined {
  if (value == null) return undefined;
  if (!VALID_MEMORY_TYPES.has(value)) {
    throw new BadRequestError(
      `Invalid type: must be "${MemoryType.SHORT_TERM}" or "${MemoryType.LONG_TERM}"`,
    );
  }
  return value as MemoryType;
}

export function createMemoryRoutes(memory: Memory) {
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
        strategy: (() => {
          const s = url.searchParams.get('strategy');
          if (s == null) return undefined;
          if (!VALID_RAG_STRATEGIES.has(s)) {
            throw new BadRequestError(`Invalid strategy: must be one of ${[...VALID_RAG_STRATEGIES].join(', ')}`);
          }
          return s as RAGStrategy;
        })(),
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

    listEntries: async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
      const type = validateMemoryType(url.searchParams.get('type'));
      const agentId = url.searchParams.get('agentId') ?? undefined;

      // Use search with a broad query for listing, or query SQLite directly
      const results = await memory.search({
        query: url.searchParams.get('query') ?? '*',
        limit: limit * page,
        type,
        agentId,
      });

      const startIdx = (page - 1) * limit;
      const paginatedEntries = results.entries.slice(startIdx, startIdx + limit);

      return jsonResponse({
        entries: paginatedEntries,
        page,
        limit,
        totalCount: results.totalCount,
      });
    },

    getEntry: async (_req: Request, params: RouteParams): Promise<Response> => {
      const id = params.id;
      if (!id) throw new BadRequestError('id parameter is required');

      const entry = await memory.get(id);
      if (!entry) throw new NotFoundError(`Memory entry "${id}" not found`);

      return jsonResponse(entry);
    },

    deleteEntry: async (_req: Request, params: RouteParams): Promise<Response> => {
      const id = params.id;
      if (!id) throw new BadRequestError('id parameter is required');

      const deleted = await memory.delete(id);
      if (!deleted) throw new NotFoundError(`Memory entry "${id}" not found`);

      return jsonResponse({ deleted: id });
    },

    clearSession: async (_req: Request, params: RouteParams): Promise<Response> => {
      const sessionId = params.sessionId;
      if (!sessionId) throw new BadRequestError('sessionId parameter is required');

      const count = await memory.clearSession(sessionId);
      return jsonResponse({ cleared: count, sessionId });
    },
  };
}
