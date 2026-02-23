export interface PageDefinition {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  navGroup: string;
  navOrder: number;
  agentId: string | null;
  status: 'active' | 'disabled' | 'error';
  filePath: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface CreatePageRequest {
  slug: string;
  title: string;
  description?: string;
  icon?: string;
  navGroup?: string;
  navOrder?: number;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdatePageRequest {
  title?: string;
  description?: string;
  icon?: string;
  navGroup?: string;
  navOrder?: number;
  status?: 'active' | 'disabled' | 'error';
  metadata?: Record<string, unknown>;
}
