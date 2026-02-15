import type { AgentDefinition, AgentId, AgentRuntimeInfo } from '@autonomy/shared';
import { DEFAULTS } from '@autonomy/shared';
import { AgentProcess } from './agent-process.ts';
import type { CLIBackend } from './backends/types.ts';
import { AgentManagerError, AgentNotFoundError, MaxAgentsReachedError } from './errors.ts';

export interface AgentPoolOptions {
  maxAgents?: number;
  idleTimeoutMs?: number;
}

export class AgentPool {
  private agents = new Map<AgentId, AgentProcess>();
  private backend: CLIBackend;
  private maxAgents: number;
  private idleTimeoutMs: number;

  constructor(backend: CLIBackend, options?: AgentPoolOptions) {
    this.backend = backend;
    this.maxAgents = options?.maxAgents ?? DEFAULTS.MAX_AGENTS;
    this.idleTimeoutMs = options?.idleTimeoutMs ?? 0;
  }

  async create(definition: AgentDefinition): Promise<AgentProcess> {
    if (this.agents.has(definition.id)) {
      throw new AgentManagerError(`Agent "${definition.id}" already exists`);
    }
    if (this.agents.size >= this.maxAgents) {
      throw new MaxAgentsReachedError(this.maxAgents);
    }

    const agent = new AgentProcess(definition, this.backend, {
      idleTimeoutMs: this.idleTimeoutMs,
    });
    await agent.start();
    this.agents.set(definition.id, agent);
    return agent;
  }

  get(id: AgentId): AgentProcess | undefined {
    return this.agents.get(id);
  }

  list(): AgentRuntimeInfo[] {
    return [...this.agents.values()].map((a) => a.toRuntimeInfo());
  }

  async remove(id: AgentId): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent) return;
    await agent.stop();
    this.agents.delete(id);
  }

  async sendMessage(id: AgentId, message: string): Promise<string> {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new AgentNotFoundError(id);
    }
    return agent.sendMessage(message);
  }

  async shutdown(): Promise<void> {
    const stopPromises = [...this.agents.values()].map((a) => a.stop());
    await Promise.all(stopPromises);
    this.agents.clear();
  }
}
