import type { AgentPool } from '@autonomy/agent-manager';
import type { CronManager } from '@autonomy/cron-manager';
import type { MemoryInterface } from '@autonomy/shared';
import { getErrorDetail, Logger } from '@autonomy/shared';
import type { AgentStore } from '../agent-store.ts';
import { DisabledMemory } from '../disabled-memory.ts';
import { jsonResponse, parseJsonBody } from '../middleware.ts';
import { runCronSeeds, runSeeds } from '../seeds/index.ts';
import type { SessionStore } from '../session-store.ts';

const logger = new Logger({ context: { source: 'system-reset' } });

const MAX_PURGE_ITERATIONS = 200;

interface SystemResetDeps {
  pool: AgentPool;
  agentStore: AgentStore;
  sessionStore: SessionStore;
  cronManager: CronManager;
  memory: MemoryInterface;
}

export function createSystemRoutes(deps: SystemResetDeps) {
  const { pool, agentStore, sessionStore, cronManager, memory } = deps;

  return {
    reset: async (req: Request): Promise<Response> => {
      const body = await parseJsonBody<{ purgeMemory?: boolean }>(req);
      const purgeMemory = body.purgeMemory === true;

      logger.warn('System reset initiated', { purgeMemory });

      // 1. Stop all running agents
      await pool.shutdown();
      logger.info('All agents stopped');

      // 2. Clear agent store (SQLite)
      agentStore.deleteAll();
      logger.info('Agent store cleared');

      // 3. Clear session store (SQLite)
      sessionStore.deleteAll();
      logger.info('Session store cleared');

      // 4. Clear crons
      await cronManager.removeAll();
      logger.info('Crons cleared');

      // 5. Optionally purge memory (always fetch page 1 since deletions shift pages)
      let memoryPurged = false;
      let memoryDeleted = 0;
      if (purgeMemory && !(memory instanceof DisabledMemory)) {
        try {
          const batchSize = 100;
          let iterations = 0;
          while (iterations < MAX_PURGE_ITERATIONS) {
            const result = await memory.list({ page: 1, limit: batchSize });
            if (result.entries.length === 0) break;
            const settled = await Promise.allSettled(
              result.entries.map((e) => memory.delete(e.id)),
            );
            memoryDeleted += settled.filter((r) => r.status === 'fulfilled').length;
            iterations++;
          }
          memoryPurged = true;
          logger.info('Memory purged', { deleted: memoryDeleted });
        } catch (err) {
          logger.warn('Memory purge failed', { error: getErrorDetail(err) });
        }
      }

      // 6. Re-seed defaults
      let seedFailed = false;
      try {
        await runSeeds(pool, agentStore);
        await pool.restore();
        await runCronSeeds(cronManager);
        logger.info('Seeds re-applied');
      } catch (err) {
        seedFailed = true;
        logger.error('Re-seeding failed after reset', { error: getErrorDetail(err) });
      }

      logger.warn('System reset complete');

      return jsonResponse({
        reset: true,
        memoryPurged,
        memoryEntriesDeleted: memoryDeleted,
        agentsRestored: pool.list().length,
        seedFailed,
      });
    },
  };
}
