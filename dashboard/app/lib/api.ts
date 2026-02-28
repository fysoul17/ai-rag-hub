import type {
  ActivityEntry,
  AgentRuntimeInfo,
  ApiResponse,
  BackendStatusResponse,
  CreateAgentRequest,
  CreateCronRequest,
  CreateSessionRequest,
  CronEntry,
  CronEntryWithStatus,
  CronExecutionLog,
  EnvironmentConfig,
  GraphNode,
  GraphTraversalResult,
  HealthCheckResponse,
  MemoryIngestRequest,
  MemorySearchResult,
  MemoryStats,
  PlatformConfig,
  RAGStrategy,
  Session,
  SessionDetail,
  SessionListResponse,
  UpdateAgentRequest,
  UpdateCronRequest,
  UpdateSessionRequest,
} from '@autonomy/shared';

const RUNTIME_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_RUNTIME_URL ?? 'http://localhost:7820')
    : 'http://localhost:7820';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(`${RUNTIME_URL}${path}`, {
    ...options,
    headers,
  });

  const body = (await res.json()) as ApiResponse<T>;

  if (!body.success || body.data === undefined) {
    throw new Error(body.error ?? `API error: ${res.status}`);
  }

  return body.data;
}

export async function getHealth(): Promise<HealthCheckResponse> {
  return fetchApi<HealthCheckResponse>('/health');
}

export async function getAgents(): Promise<AgentRuntimeInfo[]> {
  return fetchApi<AgentRuntimeInfo[]>('/api/agents');
}

export async function createAgent(data: CreateAgentRequest): Promise<AgentRuntimeInfo> {
  return fetchApi<AgentRuntimeInfo>('/api/agents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteAgent(id: string): Promise<{ deleted: string }> {
  return fetchApi<{ deleted: string }>(`/api/agents/${id}`, {
    method: 'DELETE',
  });
}

export async function restartAgent(id: string): Promise<AgentRuntimeInfo> {
  return fetchApi<AgentRuntimeInfo>(`/api/agents/${id}/restart`, {
    method: 'POST',
  });
}

export async function searchMemory(query: string, limit = 10): Promise<MemorySearchResult> {
  return fetchApi<MemorySearchResult>(
    `/api/memory/search?query=${encodeURIComponent(query)}&limit=${limit}`,
  );
}

export async function ingestMemory(data: MemoryIngestRequest): Promise<unknown> {
  return fetchApi<unknown>('/api/memory/ingest', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMemoryStats(): Promise<MemoryStats> {
  return fetchApi<MemoryStats>('/api/memory/stats');
}

export async function getActivity(limit = 50): Promise<ActivityEntry[]> {
  return fetchApi<ActivityEntry[]>(`/api/activity?limit=${limit}`);
}

export async function getConfig(): Promise<PlatformConfig> {
  return fetchApi<PlatformConfig>('/api/config');
}

export async function getCrons(): Promise<CronEntryWithStatus[]> {
  return fetchApi<CronEntryWithStatus[]>('/api/crons');
}

export async function createCron(data: CreateCronRequest): Promise<CronEntry> {
  return fetchApi<CronEntry>('/api/crons', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCron(id: string, data: UpdateCronRequest): Promise<CronEntry> {
  return fetchApi<CronEntry>(`/api/crons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCron(id: string): Promise<{ deleted: string }> {
  return fetchApi<{ deleted: string }>(`/api/crons/${id}`, {
    method: 'DELETE',
  });
}

export async function triggerCron(id: string): Promise<CronExecutionLog> {
  return fetchApi<CronExecutionLog>(`/api/crons/${id}/trigger`, {
    method: 'POST',
  });
}

export async function getCronLogs(cronId?: string, limit?: number): Promise<CronExecutionLog[]> {
  const params = new URLSearchParams();
  if (cronId) params.set('cronId', cronId);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return fetchApi<CronExecutionLog[]>(`/api/crons/logs${qs ? `?${qs}` : ''}`);
}

// Advanced memory API

export async function searchMemoryWithStrategy(
  query: string,
  options?: { limit?: number; strategy?: RAGStrategy; type?: string; agentId?: string },
): Promise<MemorySearchResult> {
  const params = new URLSearchParams({ query });
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.strategy) params.set('strategy', options.strategy);
  if (options?.type) params.set('type', options.type);
  if (options?.agentId) params.set('agentId', options.agentId);
  return fetchApi<MemorySearchResult>(`/api/memory/search?${params}`);
}

export async function deleteMemoryEntry(id: string): Promise<{ deleted: string }> {
  return fetchApi<{ deleted: string }>(`/api/memory/entries/${id}`, {
    method: 'DELETE',
  });
}

export async function getGraphData(): Promise<{
  nodes: GraphNode[];
  totalCount: number;
}> {
  return fetchApi(`/api/memory/graph/nodes`);
}

export async function queryGraph(nodeId: string, depth = 1): Promise<GraphTraversalResult> {
  return fetchApi<GraphTraversalResult>('/api/memory/graph/query', {
    method: 'POST',
    body: JSON.stringify({ nodeId, depth }),
  });
}

export async function uploadFile(file: File): Promise<unknown> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${RUNTIME_URL}/api/memory/ingest/file`, {
    method: 'POST',
    body: formData,
  });

  const body = (await res.json()) as ApiResponse<unknown>;
  if (!body.success || body.data === undefined) {
    throw new Error(body.error ?? `API error: ${res.status}`);
  }
  return body.data;
}

// --- Memory Lifecycle Operations ---

export async function consolidateMemory(): Promise<{
  entriesProcessed: number;
  entriesMerged: number;
  entriesArchived: number;
  durationMs: number;
}> {
  return fetchApi('/api/memory/consolidate', { method: 'POST' });
}

export async function forgetMemory(id: string, reason?: string): Promise<{ forgotten: boolean }> {
  return fetchApi(`/api/memory/forget/${id}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function decayMemory(): Promise<{ archivedCount: number }> {
  return fetchApi('/api/memory/decay', { method: 'POST' });
}

export async function reindexMemory(): Promise<{ reindexed: boolean }> {
  return fetchApi('/api/memory/reindex', { method: 'POST' });
}

export async function summarizeSession(sessionId: string): Promise<unknown> {
  return fetchApi(`/api/memory/sessions/${sessionId}/summarize`, {
    method: 'POST',
  });
}

export async function deleteBySource(source: string): Promise<{ deletedCount: number }> {
  return fetchApi(`/api/memory/source/${encodeURIComponent(source)}`, {
    method: 'DELETE',
  });
}

export async function getConsolidationLog(limit = 10): Promise<{ log: unknown[] }> {
  return fetchApi(`/api/memory/consolidation-log?limit=${limit}`);
}

export async function queryAsOf(
  asOf: string,
  options?: { type?: string; agentId?: string; limit?: number },
): Promise<{ entries: unknown[]; totalCount: number }> {
  const params = new URLSearchParams({ asOf });
  if (options?.type) params.set('type', options.type);
  if (options?.agentId) params.set('agentId', options.agentId);
  if (options?.limit) params.set('limit', String(options.limit));
  return fetchApi(`/api/memory/query-as-of?${params}`);
}

// --- Graph Mutations ---

export async function createGraphNode(data: {
  name: string;
  type: string;
  properties?: Record<string, unknown>;
}): Promise<GraphNode> {
  return fetchApi('/api/memory/graph/nodes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createGraphRelationship(data: {
  sourceId: string;
  targetId: string;
  type: string;
  properties?: Record<string, unknown>;
  memoryEntryId?: string;
}): Promise<unknown> {
  return fetchApi('/api/memory/graph/relationships', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteGraphNode(id: string): Promise<{ deleted: string }> {
  return fetchApi(`/api/memory/graph/nodes/${id}`, {
    method: 'DELETE',
  });
}

export async function getGraphRelationships(
  limit = 200,
): Promise<{ relationships: unknown[]; totalCount: number }> {
  return fetchApi(`/api/memory/graph/relationships?limit=${limit}`);
}

// --- Agent Update ---

export async function updateAgent(id: string, data: UpdateAgentRequest): Promise<AgentRuntimeInfo> {
  return fetchApi<AgentRuntimeInfo>(`/api/agents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// --- Config ---

export async function getRuntimeConfig(): Promise<EnvironmentConfig> {
  return fetchApi<EnvironmentConfig>('/api/config');
}

export async function updateConfig(data: Record<string, unknown>): Promise<EnvironmentConfig> {
  return fetchApi<EnvironmentConfig>('/api/config', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// --- Backends ---

export async function getBackendStatus(): Promise<BackendStatusResponse> {
  return fetchApi<BackendStatusResponse>('/api/backends/status');
}

export async function updateBackendApiKey(
  backendName: string,
  apiKey: string | null,
): Promise<BackendStatusResponse> {
  return fetchApi<BackendStatusResponse>(`/api/backends/${backendName}/api-key`, {
    method: 'PUT',
    body: JSON.stringify({ apiKey }),
  });
}

export async function logoutBackend(backendName: string): Promise<BackendStatusResponse> {
  return fetchApi<BackendStatusResponse>(`/api/backends/${backendName}/logout`, {
    method: 'POST',
  });
}

// --- Sessions ---

export async function getSessions(options?: {
  agentId?: string;
  page?: number;
  limit?: number;
}): Promise<SessionListResponse> {
  const params = new URLSearchParams();
  if (options?.agentId) params.set('agentId', options.agentId);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  return fetchApi<SessionListResponse>(`/api/sessions${qs ? `?${qs}` : ''}`);
}

export async function getSession(id: string): Promise<SessionDetail> {
  return fetchApi<SessionDetail>(`/api/sessions/${id}`);
}

export async function createSession(data: CreateSessionRequest): Promise<Session> {
  return fetchApi<Session>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSession(id: string, data: UpdateSessionRequest): Promise<Session> {
  return fetchApi<Session>(`/api/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSession(id: string): Promise<{ deleted: string }> {
  return fetchApi<{ deleted: string }>(`/api/sessions/${id}`, {
    method: 'DELETE',
  });
}
