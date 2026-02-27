import type { AuthMiddleware, InstanceRegistry } from '@autonomy/control-plane';
import { getAuthContext } from '@autonomy/control-plane';
import { ApiKeyScope } from '@autonomy/shared';
import { BadRequestError, NotFoundError, ServerError } from '../errors.ts';
import { jsonResponse } from '../middleware.ts';
import type { RouteParams } from '../router.ts';

export function createInstanceRoutes(registry: InstanceRegistry, authMiddleware: AuthMiddleware) {
  function requireScope(req: Request, scope: ApiKeyScope): void {
    const ctx = getAuthContext(req);
    if (!authMiddleware.hasScope(ctx, scope)) {
      throw new ServerError('Insufficient permissions', 403);
    }
  }

  return {
    list: async (req: Request): Promise<Response> => {
      requireScope(req, ApiKeyScope.ADMIN);
      const instances = registry.list();
      return jsonResponse(instances);
    },

    remove: async (req: Request, params: RouteParams): Promise<Response> => {
      requireScope(req, ApiKeyScope.ADMIN);
      const { id } = params;
      if (!id) throw new BadRequestError('Missing instance ID');

      const removed = registry.remove(id);
      if (!removed) {
        throw new NotFoundError('Instance not found or cannot remove active instance');
      }

      return jsonResponse({ deleted: id });
    },
  };
}
