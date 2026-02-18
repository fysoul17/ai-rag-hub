// Session types — Step 13

export const SessionStatus = {
  ACTIVE: 'active',
  CLOSED: 'closed',
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export interface Session {
  id: string;
  title: string;
  agentId?: string;
  status: SessionStatus;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateSessionRequest {
  title?: string;
  agentId?: string;
}

export interface UpdateSessionRequest {
  title?: string;
}

export interface SessionDetail extends Session {
  messages: SessionMessage[];
}

export interface SessionListResponse {
  sessions: Session[];
  total: number;
  page: number;
  limit: number;
}
