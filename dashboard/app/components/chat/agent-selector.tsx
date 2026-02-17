'use client';

import type { AgentRuntimeInfo } from '@autonomy/shared';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface AgentSelectorProps {
  agents: AgentRuntimeInfo[];
  selected: string | undefined;
  onSelect: (agentId: string | undefined) => void;
  conductorName?: string;
}

const statusDot: Record<string, string> = {
  active: 'bg-neon-cyan',
  idle: 'bg-neon-amber',
  busy: 'bg-neon-purple',
  stopped: 'bg-muted-foreground',
  error: 'bg-neon-red',
};

export function AgentSelector({
  agents,
  selected,
  onSelect,
  conductorName = 'Conductor',
}: AgentSelectorProps) {
  return (
    <ScrollArea className="border-b border-border">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => onSelect(undefined)}
          aria-label={conductorName}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
            selected === undefined
              ? 'bg-neon-purple/20 text-neon-purple glow-purple'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {conductorName}
        </button>
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => onSelect(agent.id)}
            aria-label={`${agent.name} (${agent.status})`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              selected === agent.id
                ? 'bg-primary/20 text-primary glow-cyan'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${statusDot[agent.status] ?? 'bg-muted-foreground'}`}
              aria-hidden="true"
            />
            {agent.name}
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
