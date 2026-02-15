/**
 * Test fixtures and factories for @autonomy/memory tests.
 * Follows the makeAgent() pattern from agent-manager.
 */

import type { GraphEdge, MemoryEntry, MemorySearchParams } from '@autonomy/shared';
import { MemoryType } from '@autonomy/shared';

/** Build a minimal valid MemoryEntry for tests. */
export function makeMemoryEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: `mem-${Math.random().toString(36).slice(2, 8)}`,
    content: 'Test memory content',
    type: MemoryType.LONG_TERM,
    metadata: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Build MemorySearchParams for tests. */
export function makeSearchParams(overrides: Partial<MemorySearchParams> = {}): MemorySearchParams {
  return {
    query: 'test query',
    ...overrides,
  };
}

/** Build a minimal valid GraphEdge for tests. */
export function makeGraphEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: `edge-${Math.random().toString(36).slice(2, 8)}`,
    sourceEntity: 'EntityA',
    targetEntity: 'EntityB',
    relation: 'related_to',
    weight: 1.0,
    memoryEntryId: 'mem-test',
    ...overrides,
  };
}
