import { Database } from 'bun:sqlite';
import type { MemoryEntry, MemoryType, AgentId } from '@autonomy/shared';
import { MemoryStoreError } from './errors.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('short-term', 'long-term')),
  agent_id TEXT,
  session_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(type);
CREATE INDEX IF NOT EXISTS idx_memory_agent ON memory_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_session ON memory_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_created ON memory_entries(created_at);

CREATE TABLE IF NOT EXISTS graph_edges (
  id TEXT PRIMARY KEY,
  source_entity TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  relation TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  memory_entry_id TEXT NOT NULL,
  FOREIGN KEY (memory_entry_id) REFERENCES memory_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_edge_source ON graph_edges(source_entity);
CREATE INDEX IF NOT EXISTS idx_edge_target ON graph_edges(target_entity);
CREATE INDEX IF NOT EXISTS idx_edge_memory ON graph_edges(memory_entry_id);
`;

/** Query filters for retrieving memory entries. */
export interface QueryFilters {
  type?: MemoryType;
  agentId?: AgentId;
  sessionId?: string;
  limit?: number;
}

/** Row shape from SQLite before deserialization. */
interface MemoryRow {
  id: string;
  content: string;
  type: string;
  agent_id: string | null;
  session_id: string | null;
  metadata: string;
  created_at: string;
}

export class SQLiteStore {
  private db: Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(SCHEMA);
  }

  store(entry: MemoryEntry): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO memory_entries (id, content, type, agent_id, session_id, metadata, created_at)
        VALUES ($id, $content, $type, $agent_id, $session_id, $metadata, $created_at)
      `);
      stmt.run({
        $id: entry.id,
        $content: entry.content,
        $type: entry.type,
        $agent_id: entry.agentId ?? null,
        $session_id: entry.sessionId ?? null,
        $metadata: JSON.stringify(entry.metadata),
        $created_at: entry.createdAt,
      });
    } catch (error) {
      throw new MemoryStoreError('insert', error instanceof Error ? error.message : String(error));
    }
  }

  get(id: string): MemoryEntry | null {
    const stmt = this.db.prepare('SELECT * FROM memory_entries WHERE id = $id');
    const row = stmt.get({ $id: id }) as MemoryRow | null;
    if (!row) return null;
    return this.rowToEntry(row);
  }

  query(filters: QueryFilters = {}): MemoryEntry[] {
    const conditions: string[] = [];
    const params: Record<string, string | number> = {};

    if (filters.type) {
      conditions.push('type = $type');
      params.$type = filters.type;
    }
    if (filters.agentId) {
      conditions.push('agent_id = $agent_id');
      params.$agent_id = filters.agentId;
    }
    if (filters.sessionId) {
      conditions.push('session_id = $session_id');
      params.$session_id = filters.sessionId;
    }

    let sql = 'SELECT * FROM memory_entries';
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ' ORDER BY created_at DESC';
    if (filters.limit != null && Number.isFinite(filters.limit) && filters.limit > 0) {
      sql += ` LIMIT ${Math.floor(filters.limit)}`;
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(params) as MemoryRow[];
    return rows.map((r) => this.rowToEntry(r));
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM memory_entries WHERE id = $id');
    const result = stmt.run({ $id: id });
    return result.changes > 0;
  }

  deleteBySession(sessionId: string): number {
    const stmt = this.db.prepare(
      "DELETE FROM memory_entries WHERE session_id = $session_id AND type = 'short-term'",
    );
    const result = stmt.run({ $session_id: sessionId });
    return result.changes;
  }

  count(filters: QueryFilters = {}): number {
    const conditions: string[] = [];
    const params: Record<string, string> = {};

    if (filters.type) {
      conditions.push('type = $type');
      params.$type = filters.type;
    }
    if (filters.agentId) {
      conditions.push('agent_id = $agent_id');
      params.$agent_id = filters.agentId;
    }

    let sql = 'SELECT COUNT(*) as cnt FROM memory_entries';
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const stmt = this.db.prepare(sql);
    const row = stmt.get(params) as { cnt: number };
    return row.cnt;
  }

  getEntriesByIds(ids: string[]): MemoryEntry[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map((_, i) => `$id${i}`).join(', ');
    const params: Record<string, string> = {};
    for (let i = 0; i < ids.length; i++) {
      params[`$id${i}`] = ids[i]!;
    }
    const stmt = this.db.prepare(`SELECT * FROM memory_entries WHERE id IN (${placeholders})`);
    const rows = stmt.all(params) as MemoryRow[];
    return rows.map((r) => this.rowToEntry(r));
  }

  close(): void {
    this.db.close();
  }

  private rowToEntry(row: MemoryRow): MemoryEntry {
    return {
      id: row.id,
      content: row.content,
      type: row.type as MemoryType,
      agentId: row.agent_id ?? undefined,
      sessionId: row.session_id ?? undefined,
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
      createdAt: row.created_at,
    };
  }
}
