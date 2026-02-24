import type { MemoryInterface } from '@pyx-memory/client';
import type { CreateSessionRequest, UpdateSessionRequest } from '@autonomy/shared';
import { BadRequestError, NotFoundError } from '../errors.ts';
import { jsonResponse, parseJsonBody } from '../middleware.ts';
import type { RouteParams } from '../router.ts';
import type { SessionStore } from '../session-store.ts';

export function createSessionRoutes(store: SessionStore, memory: MemoryInterface) {
  return {
    list: async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const agentId = url.searchParams.get('agentId') ?? undefined;
      const pageRaw = url.searchParams.get('page');
      const limitRaw = url.searchParams.get('limit');
      const page = pageRaw ? parseInt(pageRaw, 10) || 1 : undefined;
      const limit = limitRaw ? parseInt(limitRaw, 10) || 20 : undefined;

      const result = store.list({ agentId, page, limit });
      return jsonResponse(result);
    },

    create: async (req: Request): Promise<Response> => {
      const body = await parseJsonBody<CreateSessionRequest>(req);
      const session = store.create(body);
      return jsonResponse(session, 201);
    },

    get: async (_req: Request, params: RouteParams): Promise<Response> => {
      const { id } = params;
      if (!id) throw new BadRequestError('Session id is required');

      const detail = store.getDetail(id);
      if (!detail) throw new NotFoundError(`Session "${id}" not found`);

      return jsonResponse(detail);
    },

    update: async (req: Request, params: RouteParams): Promise<Response> => {
      const { id } = params;
      if (!id) throw new BadRequestError('Session id is required');

      const body = await parseJsonBody<UpdateSessionRequest>(req);
      if (body.title === undefined) {
        throw new BadRequestError('title is required');
      }

      const session = store.update(id, body);
      if (!session) throw new NotFoundError(`Session "${id}" not found`);

      return jsonResponse(session);
    },

    remove: async (_req: Request, params: RouteParams): Promise<Response> => {
      const { id } = params;
      if (!id) throw new BadRequestError('Session id is required');

      const deleted = store.delete(id);
      if (!deleted) throw new NotFoundError(`Session "${id}" not found`);

      // Clear any memory associated with this session
      try {
        await memory.clearSession(id);
      } catch {
        // Log but don't fail the delete
        console.warn(`[sessions] Failed to clear memory for session ${id}`);
      }

      return jsonResponse({ deleted: id });
    },
  };
}
