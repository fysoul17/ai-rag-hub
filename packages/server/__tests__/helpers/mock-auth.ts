import type { AuthMiddleware } from '@autonomy/control-plane';

/** A mock AuthMiddleware that always permits access (mimics disabled auth). */
export function createMockAuthMiddleware(): AuthMiddleware {
  return {
    authenticate: () => ({ authenticated: false, apiKey: null, scopes: [] }),
    hasScope: () => true,
  } as unknown as AuthMiddleware;
}
