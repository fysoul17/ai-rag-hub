import type { ConfigManager, ConfigUpdateError } from '../config-manager.ts';
import { BadRequestError } from '../errors.ts';
import { jsonResponse, parseJsonBody } from '../middleware.ts';

const SECRET_KEYS = ['ANTHROPIC_API_KEY', 'CODEX_API_KEY', 'GEMINI_API_KEY', 'PI_API_KEY'] as const;

function redactSecrets<T extends object>(config: T): T {
  const redacted = { ...config } as Record<string, unknown>;
  for (const key of SECRET_KEYS) {
    if (key in redacted && redacted[key]) {
      redacted[key] = '***';
    }
  }
  return redacted as T;
}

export function createConfigRoutes(configManager: ConfigManager) {
  return {
    get: async (_req: Request): Promise<Response> => {
      const config = configManager.get();
      const redacted = redactSecrets(config);
      return jsonResponse(redacted);
    },

    update: async (req: Request): Promise<Response> => {
      const body = await parseJsonBody<Record<string, unknown>>(req);

      try {
        const updated = configManager.update(body);
        const redacted = redactSecrets(updated);
        return jsonResponse(redacted);
      } catch (error) {
        if ((error as ConfigUpdateError).name === 'ConfigUpdateError') {
          throw new BadRequestError((error as Error).message);
        }
        throw error;
      }
    },
  };
}
