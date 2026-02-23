import type { Database } from 'bun:sqlite';
import type { CreatePageRequest, PageDefinition, UpdatePageRequest } from '@autonomy/shared';

interface PageRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  nav_group: string;
  nav_order: number;
  agent_id: string | null;
  status: string;
  file_path: string;
  created_at: string;
  updated_at: string;
  metadata: string;
}

export class PageStore {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
    this.migrate();
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS custom_pages (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL DEFAULT 'FileText',
        nav_group TEXT NOT NULL DEFAULT 'custom',
        nav_order INTEGER NOT NULL DEFAULT 0,
        agent_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
      )
    `);
  }

  save(id: string, data: CreatePageRequest): PageDefinition {
    const now = new Date().toISOString();
    const filePath = `app/(dashboard)/x/${data.slug}/page.tsx`;

    this.db.run(
      `INSERT INTO custom_pages (id, slug, title, description, icon, nav_group, nav_order,
        agent_id, status, file_path, created_at, updated_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      [
        id,
        data.slug,
        data.title,
        data.description ?? '',
        data.icon ?? 'FileText',
        data.navGroup ?? 'custom',
        data.navOrder ?? 0,
        data.agentId ?? null,
        filePath,
        now,
        now,
        JSON.stringify(data.metadata ?? {}),
      ],
    );

    return this.getById(id)!;
  }

  update(id: string, data: UpdatePageRequest): PageDefinition | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    this.db.run(
      `UPDATE custom_pages SET
        title = ?, description = ?, icon = ?, nav_group = ?, nav_order = ?,
        status = ?, metadata = ?, updated_at = ?
       WHERE id = ?`,
      [
        data.title ?? existing.title,
        data.description ?? existing.description,
        data.icon ?? existing.icon,
        data.navGroup ?? existing.navGroup,
        data.navOrder ?? existing.navOrder,
        data.status ?? existing.status,
        JSON.stringify(data.metadata ?? existing.metadata),
        now,
        id,
      ],
    );

    return this.getById(id);
  }

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;
    this.db.run('DELETE FROM custom_pages WHERE id = ?', [id]);
    return true;
  }

  getById(id: string): PageDefinition | null {
    const row = this.db.query('SELECT * FROM custom_pages WHERE id = ?').get(id) as PageRow | null;
    return row ? this.rowToDefinition(row) : null;
  }

  getBySlug(slug: string): PageDefinition | null {
    const row = this.db
      .query('SELECT * FROM custom_pages WHERE slug = ?')
      .get(slug) as PageRow | null;
    return row ? this.rowToDefinition(row) : null;
  }

  list(filter?: { status?: string }): PageDefinition[] {
    let sql = 'SELECT * FROM custom_pages';
    const params: string[] = [];

    if (filter?.status) {
      sql += ' WHERE status = ?';
      params.push(filter.status);
    }

    sql += ' ORDER BY nav_group ASC, nav_order ASC, created_at ASC';

    const rows = this.db.query(sql).all(...params) as PageRow[];
    return rows.map((r) => this.rowToDefinition(r));
  }

  private rowToDefinition(row: PageRow): PageDefinition {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      icon: row.icon,
      navGroup: row.nav_group,
      navOrder: row.nav_order,
      agentId: row.agent_id,
      status: row.status as PageDefinition['status'],
      filePath: row.file_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    };
  }
}
