import { VectorProvider } from '@autonomy/shared';
import * as lancedb from '@lancedb/lancedb';
import { VectorProviderError } from '../errors.ts';
import type { VectorFilter, VectorSearchResult, VectorStore, VectorStoreConfig } from './types.ts';

const TABLE_NAME = 'vectors';

/** Escape a string value for use in LanceDB SQL-like filter expressions. */
function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

export class LanceDBProvider implements VectorStore {
  readonly name = VectorProvider.LANCEDB;

  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private dimensions = 0;

  async initialize(config: VectorStoreConfig): Promise<void> {
    try {
      this.dimensions = config.dimensions;
      this.db = await lancedb.connect(config.dataDir);

      const tableNames = await this.db.tableNames();
      if (tableNames.includes(TABLE_NAME)) {
        this.table = await this.db.openTable(TABLE_NAME);
      }
    } catch (error) {
      throw new VectorProviderError(
        this.name,
        `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async upsert(
    entries: Array<{ id: string; vector: number[]; metadata: Record<string, unknown> }>,
  ): Promise<void> {
    if (!this.db) throw new VectorProviderError(this.name, 'Not initialized');
    if (entries.length === 0) return;

    try {
      const records = entries.map((e) => ({
        id: e.id,
        vector: e.vector,
        type: (e.metadata.type as string) ?? '',
        agent_id: (e.metadata.agentId as string) ?? '',
      }));

      if (!this.table) {
        this.table = await this.db.createTable(TABLE_NAME, records);
      } else {
        // Delete existing entries with the same IDs then add new ones
        const ids = entries.map((e) => `"${escapeFilterValue(e.id)}"`).join(', ');
        try {
          await this.table.delete(`id IN (${ids})`);
        } catch {
          // Ignore delete errors (entries may not exist)
        }
        await this.table.add(records);
      }
    } catch (error) {
      throw new VectorProviderError(
        this.name,
        `Upsert failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async search(
    vector: number[],
    limit: number,
    filter?: VectorFilter,
  ): Promise<VectorSearchResult[]> {
    if (!this.table) return [];

    try {
      let query = this.table.search(vector).limit(limit);

      if (filter?.type) {
        query = query.where(`type = '${escapeFilterValue(filter.type)}'`);
      }
      if (filter?.agentId) {
        query = query.where(`agent_id = '${escapeFilterValue(filter.agentId)}'`);
      }

      const results = await query.toArray();

      return results.map((row) => ({
        id: row.id as string,
        score: row._distance != null ? 1 / (1 + (row._distance as number)) : 0,
        metadata: {
          type: row.type as string,
          agentId: row.agent_id as string,
        },
      }));
    } catch (error) {
      throw new VectorProviderError(
        this.name,
        `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.table || ids.length === 0) return;

    try {
      const idList = ids.map((id) => `"${escapeFilterValue(id)}"`).join(', ');
      await this.table.delete(`id IN (${idList})`);
    } catch (error) {
      throw new VectorProviderError(
        this.name,
        `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async count(): Promise<number> {
    if (!this.table) return 0;
    try {
      return await this.table.countRows();
    } catch (error) {
      throw new VectorProviderError(
        this.name,
        `Count failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async shutdown(): Promise<void> {
    this.table = null;
    this.db = null;
  }
}
