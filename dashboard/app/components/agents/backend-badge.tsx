import type { AIBackend } from '@autonomy/shared';
import { Cpu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const backendConfig: Record<string, { label: string; className: string }> = {
  claude: {
    label: 'Claude',
    className: 'bg-status-purple/10 text-status-purple border-status-purple/20',
  },
  codex: {
    label: 'Codex',
    className: 'bg-status-green/10 text-status-green border-status-green/20',
  },
  gemini: {
    label: 'Gemini',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  pi: {
    label: 'Pi',
    className: 'bg-status-amber/10 text-status-amber border-status-amber/20',
  },
};

const defaultBackendConfig = {
  label: 'Unknown',
  className: 'bg-muted text-muted-foreground border-border',
};

export function BackendBadge({ backend }: { backend?: AIBackend }) {
  if (!backend) return null;
  const config = backendConfig[backend] ?? defaultBackendConfig;

  return (
    <Badge variant="outline" className={`gap-1 ${config.className}`}>
      <Cpu className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
