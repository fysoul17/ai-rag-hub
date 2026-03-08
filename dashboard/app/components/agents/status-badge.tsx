import type { AgentStatus } from '@autonomy/shared';
import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  active: {
    label: 'Active',
    className: 'bg-status-green/10 text-status-green border-status-green/20',
    dot: 'bg-status-green',
  },
  idle: {
    label: 'Idle',
    className: 'bg-status-amber/10 text-status-amber border-status-amber/20',
    dot: 'bg-status-amber',
  },
  busy: {
    label: 'Busy',
    className: 'bg-status-purple/10 text-status-purple border-status-purple/20',
    dot: 'bg-status-purple',
  },
  stopped: {
    label: 'Stopped',
    className: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
  error: {
    label: 'Error',
    className: 'bg-status-red/10 text-status-red border-status-red/20',
    dot: 'bg-status-red',
  },
};

const defaultStatusConfig = {
  label: 'Unknown',
  className: 'bg-muted text-muted-foreground border-border',
  dot: 'bg-muted-foreground',
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  const config = statusConfig[status] ?? defaultStatusConfig;

  return (
    <Badge variant="outline" className={`gap-1.5 ${config.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </Badge>
  );
}
