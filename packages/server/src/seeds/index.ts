// Seed registry — run all agent seeds on server startup

import type { AgentPool } from '@autonomy/agent-manager';
import { Logger } from '@autonomy/shared';

const logger = new Logger({ context: { source: 'seeds' } });

/**
 * Run all seed functions to pre-populate agents.
 * Each seed is idempotent — safe to call on every startup.
 */
export async function runSeeds(_pool: AgentPool): Promise<void> {
  logger.info('Running agent seeds...');

  const seeds: Array<(pool: AgentPool) => Promise<void>> = [
    // Register your agent seeds here, e.g.:
    // seedMyAgent,
  ];

  for (const seed of seeds) {
    try {
      await seed(_pool);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logger.warn('Seed failed', { error: detail });
    }
  }

  logger.info('Agent seeds complete');
}
