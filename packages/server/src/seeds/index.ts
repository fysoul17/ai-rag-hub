// Seed registry — run all agent seeds on server startup

import type { AgentPool } from '@autonomy/agent-manager';
import { Logger } from '@autonomy/shared';
import { seedYoutubeShortsAgent } from './youtube-shorts-agent.ts';

const logger = new Logger({ context: { source: 'seeds' } });

/**
 * Run all seed functions to pre-populate agents.
 * Each seed is idempotent — safe to call on every startup.
 */
export async function runSeeds(pool: AgentPool): Promise<void> {
  logger.info('Running agent seeds...');

  const seeds = [seedYoutubeShortsAgent];

  for (const seed of seeds) {
    try {
      await seed(pool);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logger.warn('Seed failed', { error: detail });
    }
  }

  logger.info('Agent seeds complete');
}
