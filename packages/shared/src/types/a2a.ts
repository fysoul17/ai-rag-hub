import type { AgentId } from './base.ts';

export const AIBackend = {
  CLAUDE: 'claude',
  CODEX: 'codex',
  GEMINI: 'gemini',
  GOOSE: 'goose',
} as const;
export type AIBackend = (typeof AIBackend)[keyof typeof AIBackend];

export interface BackendCapabilities {
  customTools: boolean;
  streaming: boolean;
  sessionPersistence: boolean;
  fileAccess: boolean;
}

export type BackendCapabilityMap = Record<AIBackend, BackendCapabilities>;

/** Runtime status of a registered backend. */
export interface BackendStatus {
  name: AIBackend;
  /** Whether the CLI binary is available on PATH. */
  available: boolean;
  /** Whether authentication is configured (API key or CLI login). */
  configured: boolean;
  /** Masked API key hint (e.g. "sk-ant-...7x4Q"), if applicable. */
  apiKeyMasked?: string;
  /** Auth mode detected: 'api_key', 'cli_login', or 'none'. */
  authMode: 'api_key' | 'cli_login' | 'none';
  capabilities: BackendCapabilities;
  /** Error message if the backend is unavailable. */
  error?: string;
}

export const A2ACommunicationMode = {
  DIRECT: 'direct',
  RELAY: 'relay',
} as const;
export type A2ACommunicationMode = (typeof A2ACommunicationMode)[keyof typeof A2ACommunicationMode];

export interface DelegateTaskRequest {
  fromAgentId: AgentId;
  toAgentId: AgentId;
  task: string;
  context?: string;
}

export interface DelegateTaskResult {
  fromAgentId: AgentId;
  toAgentId: AgentId;
  result: string;
  success: boolean;
  error?: string;
}

