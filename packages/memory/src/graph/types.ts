import type { GraphNode, GraphRelationship, GraphTraversalResult } from '@autonomy/shared';

export interface GraphStoreConfig {
  neo4jUrl?: string;
  neo4jUsername?: string;
  neo4jPassword?: string;
  sqliteDb?: import('bun:sqlite').Database;
}

export interface GraphStore {
  readonly name: string;
  initialize(config: GraphStoreConfig): Promise<void>;
  addNode(node: Omit<GraphNode, 'id'>): Promise<GraphNode>;
  addRelationship(rel: Omit<GraphRelationship, 'id'>): Promise<GraphRelationship>;
  findNodes(query: { name?: string; type?: string; limit?: number }): Promise<GraphNode[]>;
  getNeighbors(nodeId: string, depth?: number): Promise<GraphTraversalResult>;
  deleteNode(id: string): Promise<boolean>;
  stats(): Promise<{ nodeCount: number; edgeCount: number }>;
  shutdown(): Promise<void>;
}

export interface EntityExtractionResult {
  entities: Array<{ name: string; type: string }>;
  relations: Array<{ source: string; target: string; type: string }>;
}
