import type { AgentStatus } from '@autonomy/shared';
import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  active: {
    label: 'Active',
    className: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20',
    dot: 'bg-neon-cyan',
  },
  idle: {
    label: 'Idle',
    className: 'bg-neon-amber/10 text-neon-amber border-neon-amber/20',
    dot: 'bg-neon-amber',
  },
  busy: {
    label: 'Busy',
    className: 'bg-neon-purple/10 text-neon-purple border-neon-purple/20',
    dot: 'bg-neon-purple',
  },
  stopped: {
    label: 'Stopped',
    className: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
  error: {
    label: 'Error',
    className: 'bg-neon-red/10 text-neon-red border-neon-red/20',
    dot: 'bg-neon-red',
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
      <span className={`h-1.5 w-1.5 rounded-full animate-pulse-glow ${config.dot}`} />
      {config.label}
    </Badge>
  );
}
