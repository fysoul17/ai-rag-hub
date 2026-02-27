import type { AuthMiddleware } from '@autonomy/control-plane';
import { getAuthContext } from '@autonomy/control-plane';
import type { CronManager } from '@autonomy/cron-manager';
import { ApiKeyScope, type CreateCronRequest, type UpdateCronRequest } from '@autonomy/shared';
import { BadRequestError, NotFoundError, ServerError } from '../errors.ts';
import { jsonResponse, parseJsonBody } from '../middleware.ts';
import type { RouteParams } from '../router.ts';

export function createCronRoutes(cronManager: CronManager, authMiddleware: AuthMiddleware) {
  function requireScope(req: Request, scope: ApiKeyScope): void {
    const ctx = getAuthContext(req);
    if (!authMiddleware.hasScope(ctx, scope)) {
      throw new ServerError('Insufficient permissions', 403);
    }
  }

  return {
    list: async (req: Request): Promise<Response> => {
      requireScope(req, ApiKeyScope.CRONS);
      const crons = cronManager.getStatus();
      return jsonResponse(crons);
    },

    logs: async (req: Request): Promise<Response> => {
      requireScope(req, ApiKeyScope.CRONS);
      const url = new URL(req.url);
      const cronId = url.searchParams.get('cronId') ?? undefined;
      const limitParam = url.searchParams.get('limit');
      let limit = 50;
      if (limitParam) {
        const parsed = Number.parseInt(limitParam, 10);
        if (Number.isNaN(parsed) || parsed < 1) {
          throw new BadRequestError('limit must be a positive integer');
        }
        limit = Math.min(parsed, 200);
      }

      const logs = cronManager.getExecutionLogs(cronId, limit);
      return jsonResponse(logs);
    },

    create: async (req: Request): Promise<Response> => {
      requireScope(req, ApiKeyScope.CRONS);
      const body = await parseJsonBody<CreateCronRequest>(req);

      if (!body.name || !body.schedule || !body.workflow) {
        throw new BadRequestError('name, schedule, and workflow are required');
      }

      if (!body.workflow.steps || body.workflow.steps.length === 0) {
        throw new BadRequestError('workflow must have at least one step');
      }

      const cron = await cronManager.create({
        name: body.name,
        schedule: body.schedule,
        timezone: body.timezone,
        enabled: body.enabled,
        workflow: body.workflow,
      });

      return jsonResponse(cron, 201);
    },

    update: async (req: Request, params: RouteParams): Promise<Response> => {
      requireScope(req, ApiKeyScope.CRONS);
      const { id } = params;
      if (!id) throw new BadRequestError('Cron id is required');

      const existing = cronManager.get(id);
      if (!existing) throw new NotFoundError(`Cron "${id}" not found`);

      const body = await parseJsonBody<UpdateCronRequest>(req);

      if (body.workflow && (!body.workflow.steps || body.workflow.steps.length === 0)) {
        throw new BadRequestError('workflow must have at least one step');
      }

      const updated = await cronManager.update(id, body);
      return jsonResponse(updated);
    },

    remove: async (req: Request, params: RouteParams): Promise<Response> => {
      requireScope(req, ApiKeyScope.CRONS);
      const { id } = params;
      if (!id) throw new BadRequestError('Cron id is required');

      const existing = cronManager.get(id);
      if (!existing) throw new NotFoundError(`Cron "${id}" not found`);

      await cronManager.remove(id);
      return jsonResponse({ deleted: id });
    },

    trigger: async (req: Request, params: RouteParams): Promise<Response> => {
      requireScope(req, ApiKeyScope.CRONS);
      const { id } = params;
      if (!id) throw new BadRequestError('Cron id is required');

      const existing = cronManager.get(id);
      if (!existing) throw new NotFoundError(`Cron "${id}" not found`);

      const log = await cronManager.trigger(id);
      return jsonResponse(log);
    },
  };
}
