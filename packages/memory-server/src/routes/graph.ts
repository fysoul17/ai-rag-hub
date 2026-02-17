import type { GraphStore } from '@autonomy/memory';
import { errorResponse, jsonResponse, parseJsonBody } from '../middleware.ts';

export function createGraphRoutes(graphStore: GraphStore) {
  return {
    getNodes: async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const name = url.searchParams.get('name') ?? undefined;
      const type = url.searchParams.get('type') ?? undefined;
      const limitStr = url.searchParams.get('limit');
      const limit = limitStr ? parseInt(limitStr, 10) : 50;

      const nodes = await graphStore.findNodes({ name, type, limit });
      return jsonResponse({ nodes, totalCount: nodes.length });
    },

    getEdges: async (): Promise<Response> => {
      const { nodeCount, edgeCount } = await graphStore.stats();
      return jsonResponse({ stats: { nodeCount, edgeCount } });
    },

    query: async (req: Request): Promise<Response> => {
      try {
        const body = await parseJsonBody<{ nodeId?: string; depth?: number }>(req);
        if (!body.nodeId) {
          return errorResponse(new Error('nodeId is required'), 400);
        }
        const result = await graphStore.getNeighbors(body.nodeId, body.depth ?? 1);
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error, 400);
      }
    },
  };
}
