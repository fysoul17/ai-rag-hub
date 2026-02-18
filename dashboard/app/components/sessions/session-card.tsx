import type { Session } from '@autonomy/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/format';
import { SessionCardActions } from './session-card-actions';

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  active: {
    label: 'Active',
    className: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20',
    dot: 'bg-neon-cyan',
  },
  closed: {
    label: 'Closed',
    className: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
};

const defaultConfig = {
  label: 'Unknown',
  className: 'bg-muted text-muted-foreground border-border',
  dot: 'bg-muted-foreground',
};

export function SessionCard({ session }: { session: Session }) {
  const config = statusConfig[session.status] ?? defaultConfig;

  return (
    <Card className="glass transition-all hover:scale-[1.01] hover:border-neon-cyan/30 hover:glow-cyan">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <h3 className="truncate font-mono text-sm font-bold text-foreground">
            {session.title || 'Untitled Session'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
          </p>
        </div>
        <SessionCardActions sessionId={session.id} title={session.title || 'Untitled Session'} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`gap-1.5 ${config.className}`}>
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
            {config.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="font-mono">{session.id.slice(0, 8)}...</span>
          <span>{formatRelativeTime(session.updatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
