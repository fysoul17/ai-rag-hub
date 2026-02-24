import type { AgentRuntimeInfo } from '@autonomy/shared';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/format';
import { AgentCardActions } from './agent-card-actions';
import { BackendBadge } from './backend-badge';
import { OwnerBadge } from './owner-badge';
import { StatusBadge } from './status-badge';

const statusGlow: Record<string, string> = {
  active: 'hover:border-status-green/30',
  idle: 'hover:border-status-amber/30',
  busy: 'hover:border-status-purple/30',
  stopped: '',
  error: 'hover:border-status-red/30',
};

export function AgentCard({ agent }: { agent: AgentRuntimeInfo }) {
  const glow = statusGlow[agent.status] ?? '';

  return (
    <Card className={`card-hover accent-line-top transition-all ${glow}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-sm font-bold text-foreground">{agent.name}</h3>
          <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
        </div>
        <AgentCardActions agent={agent} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={agent.status} />
          <OwnerBadge owner={agent.owner} />
          <BackendBadge backend={agent.backend} />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="font-mono">{agent.id.slice(0, 8)}...</span>
          <span>{formatRelativeTime(agent.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
