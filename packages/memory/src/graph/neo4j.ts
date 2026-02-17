import type { GraphNode, GraphRelationship, GraphTraversalResult } from '@autonomy/shared';
import { nanoid } from 'nanoid';
import { MemoryStoreError } from '../errors.ts';
import type { GraphStore, GraphStoreConfig } from './types.ts';

// Dynamic import to avoid hard dependency when Neo4j is not used
let neo4jDriver: typeof import('neo4j-driver') | null = null;

async function getNeo4jDriver(): Promise<typeof import('neo4j-driver')> {
  if (!neo4jDriver) {
    try {
      neo4jDriver = await import('neo4j-driver');
    } catch {
      throw new MemoryStoreError(
        'neo4j',
        'neo4j-driver package not installed. Run: bun add neo4j-driver',
      );
    }
  }
  return neo4jDriver;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  const delays = [2000, 4000, 8000];
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const delay = delays[attempt] ?? 8000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

type Neo4jSession = {
  run(query: string, params?: Record<string, unknown>): Promise<{
    records: Array<{
      get(key: string): unknown;
      keys: string[];
    }>;
  }>;
  close(): Promise<void>;
};

type Neo4jDriverInstance = {
  session(): Neo4jSession;
  close(): Promise<void>;
  verifyConnectivity(): Promise<void>;
};

export class Neo4jGraphStore implements GraphStore {
  readonly name = 'neo4j';
  private driver: Neo4jDriverInstance | null = null;

  async initialize(config: GraphStoreConfig): Promise<void> {
    if (!config.neo4jUrl) {
      throw new MemoryStoreError('neo4j', 'neo4jUrl is required');
    }

    const neo4j = await getNeo4jDriver();
    const driver = neo4j.default.driver(
      config.neo4jUrl,
      neo4j.default.auth.basic(config.neo4jUsername ?? 'neo4j', config.neo4jPassword ?? ''),
    ) as unknown as Neo4jDriverInstance;

    // Verify connectivity with retry (Neo4j may take 10-30s to start)
    await withRetry(async () => {
      await driver.verifyConnectivity();
    });

    this.driver = driver;

    // Create indexes for performance
    const session = this.driver.session();
    try {
      await session.run('CREATE INDEX IF NOT EXISTS FOR (n:Entity) ON (n.name)');
      await session.run('CREATE INDEX IF NOT EXISTS FOR (n:Entity) ON (n.type)');
    } finally {
      await session.close();
    }
  }

  async addNode(node: Omit<GraphNode, 'id'>): Promise<GraphNode> {
    const session = this.ensureDriver().session();
    const id = nanoid();
    try {
      await session.run(
        `CREATE (n:Entity {
          id: $id, name: $name, type: $type,
          properties: $properties, memoryEntryIds: $memoryEntryIds
        }) RETURN n`,
        {
          id,
          name: node.name,
          type: node.type,
          properties: JSON.stringify(node.properties),
          memoryEntryIds: JSON.stringify(node.memoryEntryIds),
        },
      );
      return { id, ...node };
    } catch (error) {
      throw new MemoryStoreError('addNode', error instanceof Error ? error.message : String(error));
    } finally {
      await session.close();
    }
  }

  async addRelationship(rel: Omit<GraphRelationship, 'id'>): Promise<GraphRelationship> {
    const session = this.ensureDriver().session();
    const id = nanoid();
    try {
      await session.run(
        `MATCH (s:Entity {id: $sourceId}), (t:Entity {id: $targetId})
         CREATE (s)-[r:RELATES {id: $id, type: $type, properties: $properties, memoryEntryId: $memoryEntryId}]->(t)
         RETURN r`,
        {
          id,
          sourceId: rel.sourceId,
          targetId: rel.targetId,
          type: rel.type,
          properties: JSON.stringify(rel.properties),
          memoryEntryId: rel.memoryEntryId ?? '',
        },
      );
      return { id, ...rel };
    } catch (error) {
      throw new MemoryStoreError('addRelationship', error instanceof Error ? error.message : String(error));
    } finally {
      await session.close();
    }
  }

  async findNodes(query: { name?: string; type?: string; limit?: number }): Promise<GraphNode[]> {
    const session = this.ensureDriver().session();
    try {
      const conditions: string[] = [];
      const params: Record<string, unknown> = {};

      if (query.name) {
        conditions.push('n.name CONTAINS $name');
        params.name = query.name;
      }
      if (query.type) {
        conditions.push('n.type = $type');
        params.type = query.type;
      }

      let cypher = 'MATCH (n:Entity)';
      if (conditions.length > 0) {
        cypher += ` WHERE ${conditions.join(' AND ')}`;
      }
      cypher += ' RETURN n ORDER BY n.name';
      if (query.limit != null && query.limit > 0) {
        cypher += ' LIMIT $limit';
        params.limit = Math.floor(query.limit);
      }

      const result = await session.run(cypher, params);
      return result.records.map((record) => {
        const n = record.get('n') as Record<string, unknown>;
        const props = n.properties as Record<string, unknown>;
        return {
          id: props.id as string,
          name: props.name as string,
          type: props.type as string,
          properties: JSON.parse(props.properties as string) as Record<string, unknown>,
          memoryEntryIds: JSON.parse(props.memoryEntryIds as string) as string[],
        };
      });
    } finally {
      await session.close();
    }
  }

  async getNeighbors(nodeId: string, depth = 1): Promise<GraphTraversalResult> {
    const session = this.ensureDriver().session();
    // Cap depth to prevent unbounded traversal
    const safeDepth = Math.min(Math.max(1, Math.floor(depth)), 5);
    try {
      const result = await session.run(
        `MATCH (start:Entity {id: $nodeId})
         CALL apoc.path.subgraphAll(start, {maxLevel: $depth})
         YIELD nodes, relationships
         RETURN nodes, relationships`,
        { nodeId, depth: safeDepth },
      ).catch(async () => {
        // Fallback if APOC is not available: manual BFS via variable-length paths
        return session.run(
          `MATCH path = (start:Entity {id: $nodeId})-[*1..${safeDepth}]-(neighbor:Entity)
           UNWIND nodes(path) AS node
           UNWIND relationships(path) AS rel
           RETURN COLLECT(DISTINCT node) AS nodes, COLLECT(DISTINCT rel) AS relationships`,
          { nodeId },
        );
      });

      const nodes: GraphNode[] = [];
      const relationships: GraphRelationship[] = [];
      const paths: Array<{ nodeIds: string[]; relationshipIds: string[] }> = [];
      const seenNodeIds = new Set<string>();
      const seenRelIds = new Set<string>();

      for (const record of result.records) {
        const rawNodes = record.get('nodes') as Array<Record<string, unknown>>;
        const rawRels = record.get('relationships') as Array<Record<string, unknown>>;

        if (Array.isArray(rawNodes)) {
          for (const rawNode of rawNodes) {
            const props = (rawNode.properties ?? rawNode) as Record<string, unknown>;
            const id = props.id as string;
            if (id && !seenNodeIds.has(id)) {
              seenNodeIds.add(id);
              nodes.push({
                id,
                name: props.name as string,
                type: props.type as string,
                properties: JSON.parse((props.properties as string) ?? '{}') as Record<string, unknown>,
                memoryEntryIds: JSON.parse((props.memoryEntryIds as string) ?? '[]') as string[],
              });
            }
          }
        }

        if (Array.isArray(rawRels)) {
          for (const rawRel of rawRels) {
            const props = (rawRel.properties ?? rawRel) as Record<string, unknown>;
            const id = props.id as string;
            if (id && !seenRelIds.has(id)) {
              seenRelIds.add(id);
              const rel: GraphRelationship = {
                id,
                sourceId: (props.sourceId ?? props.source_entity ?? '') as string,
                targetId: (props.targetId ?? props.target_entity ?? '') as string,
                type: props.type as string,
                properties: JSON.parse((props.properties as string) ?? '{}') as Record<string, unknown>,
                memoryEntryId: (props.memoryEntryId as string) || undefined,
              };
              relationships.push(rel);
              paths.push({
                nodeIds: [rel.sourceId, rel.targetId],
                relationshipIds: [rel.id],
              });
            }
          }
        }
      }

      return { nodes, relationships, paths };
    } finally {
      await session.close();
    }
  }

  async deleteNode(id: string): Promise<boolean> {
    const session = this.ensureDriver().session();
    try {
      const result = await session.run(
        'MATCH (n:Entity {id: $id}) DETACH DELETE n RETURN count(n) AS deleted',
        { id },
      );
      const count = result.records[0]?.get('deleted') as number;
      return count > 0;
    } finally {
      await session.close();
    }
  }

  async stats(): Promise<{ nodeCount: number; edgeCount: number }> {
    const session = this.ensureDriver().session();
    try {
      const nodeResult = await session.run('MATCH (n:Entity) RETURN count(n) AS cnt');
      const edgeResult = await session.run('MATCH ()-[r:RELATES]->() RETURN count(r) AS cnt');
      return {
        nodeCount: (nodeResult.records[0]?.get('cnt') as number) ?? 0,
        edgeCount: (edgeResult.records[0]?.get('cnt') as number) ?? 0,
      };
    } finally {
      await session.close();
    }
  }

  async shutdown(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }

  private ensureDriver(): Neo4jDriverInstance {
    if (!this.driver) {
      throw new MemoryStoreError('neo4j', 'Neo4jGraphStore not initialized. Call initialize() first.');
    }
    return this.driver;
  }
}
