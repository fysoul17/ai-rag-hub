import type { Memory } from '@autonomy/memory';
import type { EmbeddingProviderName } from '@autonomy/shared';
import { jsonResponse } from '../middleware.ts';

interface MemoryServerHealth {
  status: string;
  uptime: number;
  memoryStatus: string;
  embeddingProvider: EmbeddingProviderName;
  version: string;
  stats?: {
    totalEntries: number;
    vectorCount: number;
    storageUsedBytes: number;
  };
}

export function createHealthRoute(
  memory: Memory,
  embeddingProvider: EmbeddingProviderName,
  startTime: number,
) {
  return async (): Promise<Response> => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    let memoryStatus = 'ok';
    let stats: MemoryServerHealth['stats'];
    try {
      const memStats = await memory.stats();
      stats = {
        totalEntries: memStats.totalEntries,
        vectorCount: memStats.vectorCount,
        storageUsedBytes: memStats.storageUsedBytes,
      };
    } catch {
      memoryStatus = 'error';
    }

    const health: MemoryServerHealth = {
      status: memoryStatus === 'error' ? 'degraded' : 'ok',
      uptime,
      memoryStatus,
      embeddingProvider,
      version: '0.0.0',
      stats,
    };

    return jsonResponse(health);
  };
}
