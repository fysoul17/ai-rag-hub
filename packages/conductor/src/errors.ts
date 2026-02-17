export class ConductorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConductorError';
  }
}

export class ConductorNotInitializedError extends ConductorError {
  constructor() {
    super('Conductor not initialized. Call initialize() first.');
    this.name = 'ConductorNotInitializedError';
  }
}

export class RoutingError extends ConductorError {
  constructor(detail: string) {
    super(`Routing failed: ${detail}`);
    this.name = 'RoutingError';
  }
}

export class DelegationError extends ConductorError {
  constructor(agentId: string, detail: string) {
    super(`Delegation to agent "${agentId}" failed: ${detail}`);
    this.name = 'DelegationError';
  }
}

export class DelegationDepthError extends ConductorError {
  constructor(depth: number, max: number) {
    super(`Delegation depth ${depth} exceeds maximum ${max}`);
    this.name = 'DelegationDepthError';
  }
}

export class ConductorShutdownError extends ConductorError {
  constructor() {
    super('Conductor is shutting down — message rejected');
    this.name = 'ConductorShutdownError';
  }
}

export class QueueFullError extends ConductorError {
  constructor(maxDepth: number) {
    super(`Message queue is full (max ${maxDepth}). Try again later.`);
    this.name = 'QueueFullError';
  }
}
