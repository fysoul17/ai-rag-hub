import { NotFoundError } from './errors.ts';
import { corsHeaders, errorResponse, handlePreflight } from './middleware.ts';

export type RouteParams = Record<string, string>;
export type RouteHandler = (req: Request, params: RouteParams) => Response | Promise<Response>;

interface Route {
  method: string;
  segments: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];
  private corsOrigin: string;

  constructor(corsOrigin: string = '*') {
    this.corsOrigin = corsOrigin;
  }

  add(method: string, pattern: string, handler: RouteHandler): void {
    const segments = pattern.split('/').filter(Boolean);
    this.routes.push({ method: method.toUpperCase(), segments, handler });
  }

  get(pattern: string, handler: RouteHandler): void {
    this.add('GET', pattern, handler);
  }

  post(pattern: string, handler: RouteHandler): void {
    this.add('POST', pattern, handler);
  }

  put(pattern: string, handler: RouteHandler): void {
    this.add('PUT', pattern, handler);
  }

  delete(pattern: string, handler: RouteHandler): void {
    this.add('DELETE', pattern, handler);
  }

  async handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return handlePreflight(this.corsOrigin);
    }

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    for (const route of this.routes) {
      if (route.method !== req.method) continue;

      const params = matchSegments(route.segments, pathSegments);
      if (params !== null) {
        try {
          const response = await route.handler(req, params);
          return this.applyCorsHeaders(response);
        } catch (error) {
          return errorResponse(error, undefined, this.corsOrigin);
        }
      }
    }

    return errorResponse(
      new NotFoundError(`No route for ${req.method} ${url.pathname}`),
      404,
      this.corsOrigin,
    );
  }

  /** Override CORS headers on outgoing responses to use the configured origin. */
  private applyCorsHeaders(response: Response): Response {
    const headers = new Headers(response.headers);
    const cors = corsHeaders(this.corsOrigin);
    for (const [key, value] of Object.entries(cors)) {
      headers.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

function matchSegments(pattern: string[], path: string[]): RouteParams | null {
  if (pattern.length !== path.length) return null;

  const params: RouteParams = {};
  for (let i = 0; i < pattern.length; i++) {
    const seg = pattern[i];
    const val = path[i];
    if (seg === undefined || val === undefined) continue;

    if (seg.startsWith(':')) {
      params[seg.slice(1)] = val;
    } else if (seg !== val) {
      return null;
    }
  }
  return params;
}
