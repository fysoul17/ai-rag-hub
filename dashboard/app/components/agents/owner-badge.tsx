import type { AgentOwner } from '@autonomy/shared';
import { CircuitBoard, Lock, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ownerConfig: Record<string, { label: string; icon: typeof Pin; className: string }> = {
  user: {
    label: 'User',
    icon: Pin,
    className: 'bg-status-green/10 text-status-green border-status-green/20',
  },
  conductor: {
    label: 'Conductor',
    icon: CircuitBoard,
    className: 'bg-status-purple/10 text-status-purple border-status-purple/20',
  },
  system: {
    label: 'System',
    icon: Lock,
    className: 'bg-muted text-muted-foreground border-border',
  },
};

const defaultOwnerConfig = {
  label: 'Unknown',
  icon: Lock,
  className: 'bg-muted text-muted-foreground border-border',
};

export function OwnerBadge({ owner }: { owner: AgentOwner }) {
  const config = ownerConfig[owner] ?? defaultOwnerConfig;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
