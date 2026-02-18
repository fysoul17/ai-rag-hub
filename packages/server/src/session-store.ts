import type { Database } from 'bun:sqlite';
import type {
  CreateSessionRequest,
  MessageRole,
  Session,
  SessionDetail,
  SessionListResponse,
  SessionMessage,
  UpdateSessionRequest,
} from '@autonomy/shared';
import { SessionStatus } from '@autonomy/shared';

interface SessionRow {
  id: string;
  title: string;
  agent_id: string | null;
  status: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  agent_id: string | null;
  metadata: string | null;
  created_at: string;
}

export class SessionStore {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
    this.migrate();
  }

  private migrate(): void {
    this.db.run('PRAGMA foreign_keys = ON');

    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        agent_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        message_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS session_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        agent_id TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    this.db.run('CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at)');
    this.db.run(
      'CREATE INDEX IF NOT EXISTS idx_session_messages_session_id ON session_messages(session_id)',
    );
  }

  create(request: CreateSessionRequest): Session {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = request.title || 'New Session';

    this.db.run(
      `INSERT INTO sessions (id, title, agent_id, status, message_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [id, title, request.agentId ?? null, SessionStatus.ACTIVE, now, now],
    );

    return {
      id,
      title,
      agentId: request.agentId,
      status: SessionStatus.ACTIVE,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  getById(id: string): Session | null {
    const row = this.db.query('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | null;
    return row ? this.rowToSession(row) : null;
  }

  getDetail(id: string): SessionDetail | null {
    const session = this.getById(id);
    if (!session) return null;

    const messageRows = this.db
      .query('SELECT * FROM session_messages WHERE session_id = ? ORDER BY created_at ASC')
      .all(id) as MessageRow[];

    return {
      ...session,
      messages: messageRows.map((r) => this.rowToMessage(r)),
    };
  }

  list(options?: { agentId?: string; page?: number; limit?: number }): SessionListResponse {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: (string | number)[] = [];

    if (options?.agentId) {
      whereClause = 'WHERE agent_id = ?';
      params.push(options.agentId);
    }

    const countRow = this.db
      .query(`SELECT COUNT(*) as count FROM sessions ${whereClause}`)
      .get(...params) as { count: number };
    const total = countRow.count;

    const rows = this.db
      .query(`SELECT * FROM sessions ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as SessionRow[];

    return {
      sessions: rows.map((r) => this.rowToSession(r)),
      total,
      page,
      limit,
    };
  }

  update(id: string, updates: UpdateSessionRequest): Session | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const sets: string[] = [];
    const values: (string | number)[] = [];

    if (updates.title !== undefined) {
      sets.push('title = ?');
      values.push(updates.title);
    }

    if (sets.length > 0) {
      const now = new Date().toISOString();
      sets.push('updated_at = ?');
      values.push(now);
      values.push(id);
      this.db.run(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`, values);
    }

    return this.getById(id) as Session;
  }

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;
    this.db.run('DELETE FROM sessions WHERE id = ?', [id]);
    return true;
  }

  addMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    agentId?: string,
    metadata?: Record<string, unknown>,
  ): SessionMessage {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const insertAndUpdate = this.db.transaction(() => {
      this.db.run(
        `INSERT INTO session_messages (id, session_id, role, content, agent_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sessionId,
          role,
          content,
          agentId ?? null,
          metadata ? JSON.stringify(metadata) : null,
          now,
        ],
      );

      this.db.run(
        'UPDATE sessions SET message_count = message_count + 1, updated_at = ? WHERE id = ?',
        [now, sessionId],
      );
    });
    insertAndUpdate();

    return {
      id,
      sessionId,
      role,
      content,
      agentId,
      metadata,
      createdAt: now,
    };
  }

  private rowToSession(row: SessionRow): Session {
    return {
      id: row.id,
      title: row.title,
      agentId: row.agent_id ?? undefined,
      status: row.status as Session['status'],
      messageCount: row.message_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToMessage(row: MessageRow): SessionMessage {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role as SessionMessage['role'],
      content: row.content,
      agentId: row.agent_id ?? undefined,
      metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
      createdAt: row.created_at,
    };
  }
}
