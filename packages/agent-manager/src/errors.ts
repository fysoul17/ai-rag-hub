export class AgentManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentManagerError';
  }
}

export class AgentNotFoundError extends AgentManagerError {
  constructor(agentId: string) {
    super(`Agent "${agentId}" not found`);
    this.name = 'AgentNotFoundError';
  }
}

export class MaxAgentsReachedError extends AgentManagerError {
  constructor(max: number) {
    super(`Maximum agent limit (${max}) reached`);
    this.name = 'MaxAgentsReachedError';
  }
}

export class AgentStateError extends AgentManagerError {
  constructor(agentId: string, currentStatus: string, action: string) {
    super(`Cannot ${action} agent "${agentId}" in "${currentStatus}" state`);
    this.name = 'AgentStateError';
  }
}

export class BackendError extends AgentManagerError {
  constructor(backend: string, message: string) {
    super(`Backend "${backend}" error: ${message}`);
    this.name = 'BackendError';
  }
}
