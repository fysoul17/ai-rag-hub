import { Database } from 'bun:sqlite';
import type { GraphNode, GraphRelationship, GraphTraversalResult } from '@autonomy/shared';
import { nanoid } from 'nanoid';
import { MemoryStoreError } from '../errors.ts';
import type { GraphStore, GraphStoreConfig } from './types.ts';

const GRAPH_NODES_SCHEMA = `
CREATE TABLE IF NOT EXISTS graph_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'entity',
  properties TEXT NOT NULL DEFAULT '{}',
  memory_entry_ids TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_graph_node_name ON graph_nodes(name);
CREATE INDEX IF NOT EXISTS idx_graph_node_type ON graph_nodes(type);
`;

export class SQLiteGraphStore implements GraphStore {
  readonly name = 'sqlite';
  private db: Database | null = null;
  private ownsDb = false;

  async initialize(config: GraphStoreConfig): Promise<void> {
    if (config.sqliteDb) {
      this.db = config.sqliteDb;
      this.ownsDb = false;
    } else {
      this.db = new Database(':memory:');
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA foreign_keys = ON;');
      this.ownsDb = true;
    }
    this.db.exec(GRAPH_NODES_SCHEMA);
  }

  async addNode(node: Omit<GraphNode, 'id'>): Promise<GraphNode> {
    const db = this.ensureDb();
    const id = nanoid();
    try {
      const stmt = db.prepare(`
        INSERT INTO graph_nodes (id, name, type, properties, memory_entry_ids)
        VALUES ($id, $name, $type, $properties, $memory_entry_ids)
      `);
      stmt.run({
        $id: id,
        $name: node.name,
        $type: node.type,
        $properties: JSON.stringify(node.properties),
        $memory_entry_ids: JSON.stringify(node.memoryEntryIds),
      });
      return { id, ...node };
    } catch (error) {
      throw new MemoryStoreError('addNode', error instanceof Error ? error.message : String(error));
    }
  }

  async addRelationship(rel: Omit<GraphRelationship, 'id'>): Promise<GraphRelationship> {
    const db = this.ensureDb();
    const id = nanoid();
    try {
      const stmt = db.prepare(`
        INSERT INTO graph_edges (id, source_entity, target_entity, relation, weight, memory_entry_id)
        VALUES ($id, $source, $target, $relation, $weight, $memory_entry_id)
      `);
      stmt.run({
        $id: id,
        $source: rel.sourceId,
        $target: rel.targetId,
        $relation: rel.type,
        $weight: (rel.properties?.weight as number) ?? 1.0,
        $memory_entry_id: rel.memoryEntryId ?? '',
      });
      return { id, ...rel };
    } catch (error) {
      throw new MemoryStoreError('addRelationship', error instanceof Error ? error.message : String(error));
    }
  }

  async findNodes(query: { name?: string; type?: string; limit?: number }): Promise<GraphNode[]> {
    const db = this.ensureDb();
    const conditions: string[] = [];
    const params: Record<string, string | number> = {};

    if (query.name) {
      conditions.push('name LIKE $name');
      params.$name = `%${query.name}%`;
    }
    if (query.type) {
      conditions.push('type = $type');
      params.$type = query.type;
    }

    let sql = 'SELECT * FROM graph_nodes';
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ' ORDER BY name ASC';
    if (query.limit != null && query.limit > 0) {
      sql += ` LIMIT ${Math.floor(query.limit)}`;
    }

    const rows = db.prepare(sql).all(params) as Array<{
      id: string;
      name: string;
      type: string;
      properties: string;
      memory_entry_ids: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      properties: JSON.parse(r.properties) as Record<string, unknown>,
      memoryEntryIds: JSON.parse(r.memory_entry_ids) as string[],
    }));
  }

  async getNeighbors(nodeId: string, depth = 1): Promise<GraphTraversalResult> {
    const db = this.ensureDb();
    // Cap depth to prevent unbounded traversal
    const safeDepth = Math.min(Math.max(1, Math.floor(depth)), 5);
    const visitedNodes = new Set<string>();
    const allNodes: GraphNode[] = [];
    const allRelationships: GraphRelationship[] = [];
    const paths: Array<{ nodeIds: string[]; relationshipIds: string[] }> = [];

    // BFS traversal
    let frontier = [nodeId];
    for (let d = 0; d < safeDepth && frontier.length > 0; d++) {
      const nextFrontier: string[] = [];
      for (const currentId of frontier) {
        if (visitedNodes.has(currentId)) continue;
        visitedNodes.add(currentId);

        // Get the node itself
        const nodeRow = db.prepare('SELECT * FROM graph_nodes WHERE id = $id').get({ $id: currentId }) as {
          id: string;
          name: string;
          type: string;
          properties: string;
          memory_entry_ids: string;
        } | null;

        if (nodeRow) {
          allNodes.push({
            id: nodeRow.id,
            name: nodeRow.name,
            type: nodeRow.type,
            properties: JSON.parse(nodeRow.properties) as Record<string, unknown>,
            memoryEntryIds: JSON.parse(nodeRow.memory_entry_ids) as string[],
          });
        }

        // Get outgoing edges
        const outEdges = db.prepare(
          'SELECT * FROM graph_edges WHERE source_entity = $id',
        ).all({ $id: currentId }) as Array<{
          id: string;
          source_entity: string;
          target_entity: string;
          relation: string;
          weight: number;
          memory_entry_id: string;
        }>;

        for (const edge of outEdges) {
          allRelationships.push({
            id: edge.id,
            sourceId: edge.source_entity,
            targetId: edge.target_entity,
            type: edge.relation,
            properties: { weight: edge.weight },
            memoryEntryId: edge.memory_entry_id || undefined,
          });
          if (!visitedNodes.has(edge.target_entity)) {
            nextFrontier.push(edge.target_entity);
            paths.push({
              nodeIds: [currentId, edge.target_entity],
              relationshipIds: [edge.id],
            });
          }
        }

        // Get incoming edges
        const inEdges = db.prepare(
          'SELECT * FROM graph_edges WHERE target_entity = $id',
        ).all({ $id: currentId }) as Array<{
          id: string;
          source_entity: string;
          target_entity: string;
          relation: string;
          weight: number;
          memory_entry_id: string;
        }>;

        for (const edge of inEdges) {
          allRelationships.push({
            id: edge.id,
            sourceId: edge.source_entity,
            targetId: edge.target_entity,
            type: edge.relation,
            properties: { weight: edge.weight },
            memoryEntryId: edge.memory_entry_id || undefined,
          });
          if (!visitedNodes.has(edge.source_entity)) {
            nextFrontier.push(edge.source_entity);
            paths.push({
              nodeIds: [edge.source_entity, currentId],
              relationshipIds: [edge.id],
            });
          }
        }
      }
      frontier = nextFrontier;
    }

    // Deduplicate relationships
    const seenRelIds = new Set<string>();
    const uniqueRels = allRelationships.filter((r) => {
      if (seenRelIds.has(r.id)) return false;
      seenRelIds.add(r.id);
      return true;
    });

    return { nodes: allNodes, relationships: uniqueRels, paths };
  }

  async deleteNode(id: string): Promise<boolean> {
    const db = this.ensureDb();
    // Delete edges connected to this node
    db.prepare('DELETE FROM graph_edges WHERE source_entity = $id OR target_entity = $id').run({ $id: id });
    const result = db.prepare('DELETE FROM graph_nodes WHERE id = $id').run({ $id: id });
    return result.changes > 0;
  }

  async stats(): Promise<{ nodeCount: number; edgeCount: number }> {
    const db = this.ensureDb();
    const nodeRow = db.prepare('SELECT COUNT(*) as cnt FROM graph_nodes').get() as { cnt: number };
    const edgeRow = db.prepare('SELECT COUNT(*) as cnt FROM graph_edges').get() as { cnt: number };
    return { nodeCount: nodeRow.cnt, edgeCount: edgeRow.cnt };
  }

  async shutdown(): Promise<void> {
    if (this.ownsDb && this.db) {
      this.db.close();
    }
    this.db = null;
  }

  private ensureDb(): Database {
    if (!this.db) {
      throw new MemoryStoreError('graph', 'SQLiteGraphStore not initialized. Call initialize() first.');
    }
    return this.db;
  }
}
