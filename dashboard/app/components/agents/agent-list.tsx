import type { AgentRuntimeInfo } from '@autonomy/shared';
import { AgentCard } from './agent-card';

interface AgentListProps {
  agents: AgentRuntimeInfo[];
}

export function AgentList({ agents }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No agents running. Create one to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
