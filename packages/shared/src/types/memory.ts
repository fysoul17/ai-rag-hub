import type { AgentId, Timestamp } from './base.ts';

export const MemoryType = {
  SHORT_TERM: 'short-term',
  LONG_TERM: 'long-term',
} as const;
export type MemoryType = (typeof MemoryType)[keyof typeof MemoryType];

export const RAGStrategy = {
  NAIVE: 'naive',
  GRAPH: 'graph',
  AGENTIC: 'agentic',
} as const;
export type RAGStrategy = (typeof RAGStrategy)[keyof typeof RAGStrategy];

export const VectorProvider = {
  LANCEDB: 'lancedb',
  QDRANT: 'qdrant',
} as const;
export type VectorProvider = (typeof VectorProvider)[keyof typeof VectorProvider];

export const EmbeddingProviderName = {
  STUB: 'stub',
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  LOCAL: 'local',
} as const;
export type EmbeddingProviderName =
  (typeof EmbeddingProviderName)[keyof typeof EmbeddingProviderName];

export interface MemoryEntry {
  id: string;
  content: string;
  type: MemoryType;
  agentId?: AgentId;
  sessionId?: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: Timestamp;
}

export interface MemorySearchParams {
  query: string;
  type?: MemoryType;
  agentId?: AgentId;
  limit?: number;
  strategy?: RAGStrategy;
}

export interface MemorySearchResult {
  entries: MemoryEntry[];
  totalCount: number;
  strategy: RAGStrategy;
}

export interface MemoryIngestRequest {
  content?: string;
  type?: MemoryType;
  fileType?: 'pdf' | 'csv' | 'txt';
  metadata?: Record<string, unknown>;
}

export interface MemoryStats {
  totalEntries: number;
  storageUsedBytes: number;
  vectorCount: number;
  recentAccessCount: number;
  graphNodeCount?: number;
  graphEdgeCount?: number;
}

export interface GraphEdge {
  id: string;
  sourceEntity: string;
  targetEntity: string;
  relation: string;
  weight: number;
  memoryEntryId: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
  memoryEntryIds: string[];
}

export interface GraphRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties: Record<string, unknown>;
  memoryEntryId?: string;
}

export interface GraphTraversalResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  paths: Array<{ nodeIds: string[]; relationshipIds: string[] }>;
}
