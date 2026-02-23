import type { PageStore } from '@autonomy/control-plane';
import type { CreatePageRequest, UpdatePageRequest } from '@autonomy/shared';
import { nanoid } from 'nanoid';
import { BadRequestError, NotFoundError } from '../errors.ts';
import { jsonResponse, parseJsonBody } from '../middleware.ts';
import type { RouteParams } from '../router.ts';

const PROTECTED_SLUGS = [
  '',
  'agents',
  'chat',
  'sessions',
  'memory',
  'automation',
  'activity',
  'settings',
  'login',
  'settings/providers',
  'settings/keys',
  'settings/usage',
];

const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\/[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

export function createPageRoutes(pageStore: PageStore) {
  return {
    list: async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const status = url.searchParams.get('status') ?? undefined;
      const pages = pageStore.list(status ? { status } : undefined);
      return jsonResponse(pages);
    },

    create: async (req: Request): Promise<Response> => {
      const body = await parseJsonBody<CreatePageRequest>(req);

      if (!body.slug || !body.title) {
        throw new BadRequestError('slug and title are required');
      }

      if (!SLUG_REGEX.test(body.slug)) {
        throw new BadRequestError(
          'Invalid slug. Use lowercase alphanumeric characters and hyphens, separated by slashes for nesting.',
        );
      }

      if (PROTECTED_SLUGS.includes(body.slug)) {
        throw new BadRequestError(`Slug "${body.slug}" is reserved and cannot be used`);
      }

      const existing = pageStore.getBySlug(body.slug);
      if (existing) {
        throw new BadRequestError(`A page with slug "${body.slug}" already exists`);
      }

      const id = nanoid();
      const page = pageStore.save(id, body);
      return jsonResponse(page, 201);
    },

    get: async (_req: Request, params: RouteParams): Promise<Response> => {
      const { id } = params;
      if (!id) throw new BadRequestError('Page id is required');

      const page = pageStore.getById(id);
      if (!page) throw new NotFoundError(`Page "${id}" not found`);

      return jsonResponse(page);
    },

    update: async (req: Request, params: RouteParams): Promise<Response> => {
      const { id } = params;
      if (!id) throw new BadRequestError('Page id is required');

      const existing = pageStore.getById(id);
      if (!existing) throw new NotFoundError(`Page "${id}" not found`);

      const body = await parseJsonBody<UpdatePageRequest>(req);
      const page = pageStore.update(id, body);
      return jsonResponse(page);
    },

    remove: async (_req: Request, params: RouteParams): Promise<Response> => {
      const { id } = params;
      if (!id) throw new BadRequestError('Page id is required');

      const deleted = pageStore.delete(id);
      if (!deleted) throw new NotFoundError(`Page "${id}" not found`);

      return jsonResponse({ deleted: id });
    },
  };
}
